"""
OCPP Alert Automation Script for be.ENERGISED Dashboard
=======================================================
DRY RUN MODE IS ON BY DEFAULT.
Set DRY_RUN = False only after verifying the logs look correct.

Setup:
    pip install playwright
    playwright install chromium

Usage:
    python ocpp_automation.py --url https://community.beenergised.cloud/infrastructure/cp/operation/dashboard
"""

import asyncio
import argparse
import json
import logging
import os
import sys
import re
from datetime import date
from collections import Counter, defaultdict
from playwright.async_api import async_playwright, Page, BrowserContext

# ---------------------------------------------------------------------------
# MASTER SWITCH
# ---------------------------------------------------------------------------
DRY_RUN = True

COOKIE_FILE = "ocpp_cookies.json"
WAIT_MINUTES = 5  # wait after each reset

# ---------------------------------------------------------------------------
# Logging - UTF-8 safe on Windows
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(
            stream=open(sys.stdout.fileno(), mode='w', encoding='utf-8', closefd=False)
        ),
        logging.FileHandler("ocpp_automation.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

if DRY_RUN:
    log.info("=" * 60)
    log.info("  DRY RUN MODE -- no actual clicks will happen")
    log.info("  Set DRY_RUN = False to go live")
    log.info("=" * 60)

# ---------------------------------------------------------------------------
# ESCALATION LOOKUP TABLE
# (manufacturer, ocpp_error, vendor_error) -> "yes" | "no"
# "yes" = needs escalation, "no" = just acknowledge
# If not found in table -> treat as "yes"
# ---------------------------------------------------------------------------
ESCALATION_TABLE: dict[tuple[str, str, str], str] = {

    # ABB
    ("ABB", "Offline", ""): "yes",
    ("ABB", "OtherError", "ChargeNotStarted:CableError"): "no",
    ("ABB", "OtherError", "ChargeNotStarted:LockError"): "no",
    ("ABB", "OtherError", "ChargeNotStarted:VehicleNotConnected"): "no",
    ("ABB", "OtherError", "ChargeNotStarted:VehicleShiftPosition"): "no",
    ("ABB", "OtherError", "ChargeStopped:CableRemoved"): "no",
    ("ABB", "OtherError", "ChargeStopped:ChargerError"): "yes",
    ("ABB", "OtherError", "ChargeStopped:IsolationTestFailed"): "yes",
    ("ABB", "OtherError", "ChargeStopped:VehicleProtocolError"): "no",
    ("ABB", "OtherError", "DoorClosed"): "no",
    ("ABB", "OtherError", "DoorOpen"): "no",
    ("ABB", "OtherError", "EmergencyButtonPressed"): "no",
    ("ABB", "OtherError", "EmergencyButtonReleased"): "no",
    ("ABB", "OtherError", "StopReason: AcsErrorAlignment"): "yes",
    ("ABB", "OtherError", "StopReason:AcsErrorExtending"): "yes",
    ("ABB", "OtherError", "StopReason: AcsErrorRetracting"): "yes",
    ("ABB", "OtherError", "StopReason: AcsExtendedTimeout"): "yes",
    ("ABB", "OtherError", "StopReason: AcsRetractedTimeout"): "yes",
    ("ABB", "OtherError", "StopReason: AuthorizedStop"): "no",
    ("ABB", "OtherError", "StopReason: BatteryFull"): "no",
    ("ABB", "OtherError", "StopReason:Blocked"): "yes",
    ("ABB", "OtherError", "StopReason:BoardPowerSupplyError"): "yes",
    ("ABB", "OtherError", "StopReason:BudgetExceeded"): "no",
    ("ABB", "OtherError", "StopReason:CableCheckCurrentRunning"): "yes",
    ("ABB", "OtherError", "StopReason:CableCheckFailed"): "yes",
    ("ABB", "OtherError", "StopReason:CableCheckVoltageNotDropping"): "yes",
    ("ABB", "OtherError", "StopReason:CableCheckVoltageTooHigh"): "yes",
    ("ABB", "OtherError", "StopReason:CableCheckVoltageTooLow"): "yes",
    ("ABB", "OtherError", "StopReason:CableError"): "yes",
    ("ABB", "OtherError", "StopReason: ChargerCabinetOvp"): "yes",
    ("ABB", "OtherError", "StopReason: ChargerCableCoolerFailure"): "yes",
    ("ABB", "OtherError", "StopReason: ChargerCableCoolerTemperature"): "no",
    ("ABB", "OtherError", "StopReason: ChargerCableTemperature"): "no",
    ("ABB", "OtherError", "StopReason: ChargerCanCommunicationLost"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerConnectorPresenceLost"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerContactorsProblem"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerContactorsProblem on outlet while charging"): "yes",
    ("ABB", "OtherError", "StopReason: ChargerContactorTemperature"): "no",
    ("ABB", "OtherError", "StopReason:ChargerError"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerError detected. X V"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerError modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerErrorCurrentDifference"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerErrorCurrentDifference (CC) detection"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerErrorCurrentDifference detected. req:X actual:Y"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerErrorCurrentDifference pwm:100%"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerLoweringCurrentTimeout"): "no",
    ("ABB", "OtherError", "StopReason:ChargerMaxVoltage"): "no",
    ("ABB", "OtherError", "StopReason:ChargerMaxVoltage modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerMcbTripped"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerMcbTripped on outlet while charging"): "yes",
    ("ABB", "OtherError", "StopReason: ChargerNeutralMismatch"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerOutletDetectionError"): "yes",
    ("ABB", "OtherError", "StopReason:ChargerPrechargeTimeout"): "no",
    ("ABB", "OtherError", "StopReason:ChargerRcdTripped"): "yes",
    ("ABB", "OtherError", "StopReason: ChargerRcdCloseError"): "yes",
    ("ABB", "OtherError", "StopReason: ChargerStopTimout"): "no",
    ("ABB", "OtherError", "StopReason:ChargerTemperatureError"): "no",
    ("ABB", "OtherError", "StopReason:ChargerTemperatureError too high"): "yes",
    ("ABB", "OtherError", "StopReason: ChargerTimeCompleted"): "no",
    ("ABB", "OtherError", "StopReason:ChargerVoltageDrop"): "yes",
    ("ABB", "OtherError", "StopReason: ConnectorButtonPressed"): "no",
    ("ABB", "OtherError", "StopReason:ConnectorError"): "yes",
    ("ABB", "OtherError", "StopReason:ConnectorError pwm:5%"): "yes",
    ("ABB", "OtherError", "StopReason:ConnectorPilotError"): "yes",
    ("ABB", "OtherError", "StopReason:ConnectorTemperatureError"): "yes",
    ("ABB", "OtherError", "StopReason:ConnectorPilotShortCircuit"): "yes",
    ("ABB", "OtherError", "StopReason: EmergencyStop"): "no",
    ("ABB", "OtherError", "StopReason:Expired"): "yes",
    ("ABB", "OtherError", "StopReason:GbProtocolBemTimeoutCrmNotIdentifiable"): "yes",
    ("ABB", "OtherError", "StopReason:GlobalInterlockFail"): "yes",
    ("ABB", "OtherError", "StopReason:GlobalInterlockFail modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason:GlobalInterlockFail with IMI, cleared all other errors"): "yes",
    ("ABB", "OtherError", "StopReason:ImiDisconnectedFromDcbus"): "yes",
    ("ABB", "OtherError", "StopReason:IncompatibleVehicle"): "no",
    ("ABB", "OtherError", "StopReason:Invalid"): "no",
    ("ABB", "OtherError", "StopReason: InvalidOnServer"): "yes",
    ("ABB", "OtherError", "StopReason: InvalidOnCharger"): "no",
    ("ABB", "OtherError", "StopReason:IsolationTestFailed"): "no",
    ("ABB", "OtherError", "StopReason:IsolationTestFailed modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason:IsolationTestFailed with IMI, cleared all other errors"): "yes",
    ("ABB", "OtherError", "StopReason:LockError"): "yes",
    ("ABB", "OtherError", "StopReason:LockError lock connector"): "yes",
    ("ABB", "OtherError", "StopReason: LockTampering"): "yes",
    ("ABB", "OtherError", "StopReason:NoError"): "no",
    ("ABB", "OtherError", "StopReason:NoError modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason: NoMatchingIDs"): "no",
    ("ABB", "OtherError", "StopReason: NormalStop"): "no",
    ("ABB", "OtherError", "StopReason: OcmNotAlive"): "yes",
    ("ABB", "OtherError", "StopReason: OcmInterlockVerificationError"): "yes",
    ("ABB", "OtherError", "StopReason: OcmCableRatingMismatch"): "yes",
    ("ABB", "OtherError", "StopReason: OnboardEnergymeterError"): "yes",
    ("ABB", "OtherError", "StopReason: OutletError"): "yes",
    ("ABB", "OtherError", "StopReason: PowerPortFanFailure"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportInterlock"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportOverheat"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportOverheat modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportPowerError"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportPowerError detected. X V"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportPowerError detected. req:X actual:Y"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportPowerError modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason: PowerPortErrorOther"): "yes",
    ("ABB", "OtherError", "StopReason: PowerPortVipError"): "no",
    ("ABB", "OtherError", "StopReason: RequestRejected"): "no",
    ("ABB", "OtherError", "StopReason: ServerUnreachable"): "yes",
    ("ABB", "OtherError", "StopReason:SoftError"): "no",
    ("ABB", "OtherError", "StopReason:SoftError modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason:SoftError with IMI, cleared all other errors"): "yes",
    ("ABB", "OtherError", "StopReason: StoppedByVehicle"): "no",
    ("ABB", "OtherError", "StopReason: UnlockError"): "yes",
    ("ABB", "OtherError", "StopReason:UserRequestedStop"): "no",
    ("ABB", "OtherError", "StopReason:UserRequestedStop modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason: VehicleBatteryMalfunction"): "no",
    ("ABB", "OtherError", "StopReason: VehicleBatteryTemperatureOutOfRange"): "no",
    ("ABB", "OtherError", "StopReason:VehicleCurrentDifference"): "no",
    ("ABB", "OtherError", "StopReason:VehicleError"): "no",
    ("ABB", "OtherError", "StopReason:VehicleErrorReversePolarity"): "no",
    ("ABB", "OtherError", "StopReason:VehicleErrorVoltageApplied"): "yes",
    ("ABB", "OtherError", "StopReason:VehicleErrorVoltageApplied modules disabled"): "no",
    ("ABB", "OtherError", "StopReason:VehicleLockError"): "yes",
    ("ABB", "OtherError", "StopReason:VehicleNotConnected"): "no",
    ("ABB", "OtherError", "StopReason:VehicleNotConnected modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason:VehicleProtocolError"): "no",
    ("ABB", "OtherError", "StopReason:VehicleProtocolError modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason: VehicleShiftPosition"): "no",
    ("ABB", "OtherError", "StopReason:VehicleStop"): "no",
    ("ABB", "OtherError", "StopReason:VehicleStop EST_UNDEF_NOSTART"): "no",
    ("ABB", "OtherError", "StopReason:VehicleStop modules disabled"): "yes",
    ("ABB", "OtherError", "StopReason:VehicleVoltageOutOfRange"): "no",
    ("ABB", "OtherError", "StopReason: VehicleWeldingDetectionTimeout"): "no",
    ("ABB", "OtherError", "StopReason: WrongMessage"): "no",
    ("ABB", "OtherError", ""): "yes",
    ("ABB", "OtherError", "ConnectorPlacedInHolder"): "no",
    ("ABB", "OtherError", "ConnectorRemovedFromHolder"): "no",
    ("ABB", "OtherError", "StopReason:OutletError"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportErrorOther"): "yes",
    ("ABB", "OtherError", "StopReason:PowerportFanFailure"): "yes",

    # ALFEN
    ("Alfen", "ConnectorLockFailure", "211"): "yes",
    ("Alfen", "ConnectorLockFailure", "404"): "yes",
    ("Alfen", "ConnectorLockFailure", "404 Unable to lock charging cable, try again"): "yes",
    ("Alfen", "GroundFailure", "105"): "yes",
    ("Alfen", "GroundFailure", "106"): "yes",
    ("Alfen", "GroundFailure", "201"): "yes",
    ("Alfen", "Offline", ""): "yes",
    ("Alfen", "OtherError", "201 PE connection, check protective earth wiring"): "yes",
    ("Alfen", "PowerMeterFailure", "105"): "yes",
    ("Alfen", "PowerMeterFailure", "106"): "yes",
    ("Alfen", "PowerSwitchFailure", "102 Power switch error"): "yes",

    # ALPITRONIC
    ("Alpitronic", "ConnectorLockFailure", "15 Lock Fault"): "yes",
    ("Alpitronic", "EVCommunicationError", "3"): "no",
    ("Alpitronic", "EVCommunicationError", "13"): "no",
    ("Alpitronic", "EVCommunicationError", "13 TCP Error"): "no",
    ("Alpitronic", "EVCommunicationError", "14 V2G Error"): "no",
    ("Alpitronic", "EVCommunicationError", "2 SLAC Error"): "no",
    ("Alpitronic", "EVCommunicationError", "3 SLAC Error"): "no",
    ("Alpitronic", "EVCommunicationError", "4 Link Error"): "no",
    ("Alpitronic", "EVCommunicationError", "5 Link Error"): "no",
    ("Alpitronic", "GroundFailure", "25"): "yes",
    ("Alpitronic", "GroundFailure", "25 Isolation Fault"): "yes",
    ("Alpitronic", "Offline", ""): "yes",
    ("Alpitronic", "OtherError", "42"): "yes",
    ("Alpitronic", "OtherError", "52"): "no",
    ("Alpitronic", "OtherError", "53"): "no",
    ("Alpitronic", "OtherError", "63"): "yes",
    ("Alpitronic", "OtherError", "29 Isolation Warning"): "yes",
    ("Alpitronic", "OtherError", "42 Meter Error"): "yes",
    ("Alpitronic", "OtherError", "50 EV Error"): "no",
    ("Alpitronic", "OtherError", "52 EV Communication Error"): "no",
    ("Alpitronic", "OtherError", "53 EV Communication Error"): "no",
    ("Alpitronic", "OtherError", "63 Cable Error"): "yes",
    ("Alpitronic", "OtherError", "70 EV Communication Error"): "no",
    ("Alpitronic", "OtherError", "75 EV Communication Error"): "no",
    ("Alpitronic", "OtherError", "78 EV Communication Error"): "no",

    # CIRCONTROL
    ("Circontrol", "Offline", ""): "yes",
    ("Circontrol", "OtherError", ""): "no",
    ("Circontrol", "ResetFailure", ""): "no",
    ("Circontrol", "OtherError", "CE.25.004"): "yes",
    ("Circontrol", "OtherError", "CE.25.009"): "yes",
    ("Circontrol", "OtherError", "CE.25.009 AC/DC converters error"): "yes",
    ("Circontrol", "OtherError", "CE.25.010"): "yes",
    ("Circontrol", "OtherError", "CE.27.103"): "no",
    ("Circontrol", "OtherError", "CE.27.103 Isolation error"): "no",
    ("Circontrol", "OtherError", "CO.00.000"): "no",
    ("Circontrol", "OtherError", "CO.00.000 Generic error"): "no",
    ("Circontrol", "OtherError", "CO.01.001"): "yes",
    ("Circontrol", "OtherError", "CO.01.002"): "no",
    ("Circontrol", "OtherError", "CO.01.003"): "no",
    ("Circontrol", "OtherError", "CO.01.003 Internal communications error"): "yes",
    ("Circontrol", "OtherError", "CO.01.007"): "yes",
    ("Circontrol", "GroundFailure", "CO.01.101"): "yes",
    ("Circontrol", "OtherError", "CO.01.102"): "no",
    ("Circontrol", "OtherError", "CO.01.103"): "yes",
    ("Circontrol", "OtherError", "CO.01.103 Internal communications error"): "yes",
    ("Circontrol", "OverVoltage", "CO.01.104"): "no",
    ("Circontrol", "UnderVoltage", "CO.01.105"): "yes",
    ("Circontrol", "HighTemperature", "CO.01.108"): "no",
    ("Circontrol", "OtherError", "CO.01.109"): "yes",
    ("Circontrol", "OtherError", "CO.01.111"): "yes",
    ("Circontrol", "OtherError", "CO.01.112"): "yes",
    ("Circontrol", "OtherError", "CO.02.102"): "yes",
    ("Circontrol", "OtherError", "CO.04.000"): "yes",
    ("Circontrol", "ReaderFailure", "CO.11.000"): "no",
    ("Circontrol", "PowerMeterFailure", "CO.14.003"): "yes",
    ("Circontrol", "OtherError", "CO.23.003"): "yes",
    ("Circontrol", "OtherError", "CO.24.001"): "yes",
    ("Circontrol", "OtherError", "CO.24.002"): "yes",
    ("Circontrol", "OtherError", "CO.24.003"): "yes",
    ("Circontrol", "OtherError", "CO.24.003 Internal communications error"): "yes",
    ("Circontrol", "OtherError", "CO.24.008 Hardware failure"): "yes",
    ("Circontrol", "OtherError", "CO.25.000"): "yes",
    ("Circontrol", "OtherError", "CO.25.000 AC/DC converters error"): "yes",
    ("Circontrol", "OtherError", "CO.25.004"): "yes",
    ("Circontrol", "OtherError", "CO.25.009"): "yes",
    ("Circontrol", "OtherError", "CO.25.010"): "yes",
    ("Circontrol", "PowerSwitchFailure", "CO.26.101"): "yes",
    ("Circontrol", "PowerSwitchFailure", "CO.26.101 Welding contactor"): "yes",
    ("Circontrol", "OtherError", "CO.27.001"): "yes",
    ("Circontrol", "OtherError", "CO.27.001 Internal power supply failure"): "yes",
    ("Circontrol", "OtherError", "CO.27.003"): "no",
    ("Circontrol", "OtherError", "CO.27.003 Internal communications error"): "no",
    ("Circontrol", "OtherError", "CO.27.102"): "yes",
    ("Circontrol", "GroundFailure", "CO.27.104"): "yes",
    ("Circontrol", "GroundFailure", "CO.27.104 Current leak detected"): "yes",
    ("Circontrol", "OverCurrentFailure", "CO.27.105"): "yes",
    ("Circontrol", "OverCurrentFailure", "CO.27.105 Overcurrent protection triggered"): "yes",
    ("Circontrol", "OtherError", "CO.30.001"): "no",
    ("Circontrol", "WeakSignal", "CW.01.110"): "no",
    ("Circontrol", "EVCommunicationError", "UE.20.101"): "no",
    ("Circontrol", "EVCommunicationError", "UE.20.101 Vehicle not detected"): "no",
    ("Circontrol", "ConnectorLockFailure", "UE.22.101"): "yes",
    ("Circontrol", "ConnectorLockFailure", "UE.22.101 Connector lock failure"): "yes",
    ("Circontrol", "OtherError", "UO.02.101"): "no",
    ("Circontrol", "OtherError", "UO.02.101 Door tamper alarm"): "no",
    ("Circontrol", "OtherError", "UO.03.101"): "no",
    ("Circontrol", "OtherError", "UO.03.101 Emergency button pressed"): "no",
    ("Circontrol", "OtherError", "VE.20.000"): "no",
    ("Circontrol", "EVCommunicationError", "VE.20.003"): "no",
    ("Circontrol", "OverCurrentFailure", "VE.20.102"): "no",
    ("Circontrol", "OtherError", "VE.21.101"): "no",
    ("Circontrol", "GroundFailure", "VE.27.101"): "yes",

    # DBT
    ("DBT", "OtherError", "0x0008"): "no",
    ("DBT", "OtherError", "0x0012"): "yes",
    ("DBT", "OtherError", "0x0013"): "yes",
    ("DBT", "OtherError", "0x0016"): "no",
    ("DBT", "OtherError", "0x0020"): "no",
    ("DBT", "OtherError", "0x0021"): "no",
    ("DBT", "OtherError", "0xf002"): "yes",
    ("DBT", "OtherError", "0xf003"): "yes",
    ("DBT", "OtherError", "0xff03"): "no",

    # COMPLEO
    ("Compleo", "ConnectorLockFailure", ""): "no",
    ("Compleo", "GroundFailure", ""): "yes",
    ("Compleo", "HighTemperature", ""): "yes",
    ("Compleo", "InternalError", ""): "yes",
    ("Compleo", "Offline", ""): "yes",
    ("Compleo", "OtherError", "AutomaticRcdResetContactorTestFailed"): "yes",
    ("Compleo", "OtherError", "AutomaticRcdResetSwitchOnFailed"): "yes",
    ("Compleo", "OtherError", "AutomaticRcdTestRunning"): "no",
    ("Compleo", "OtherError", "DcInsulationCodeFault"): "yes",
    ("Compleo", "OtherError", "DcInsulationCodeInvalid"): "no",
    ("Compleo", "OtherError", "DcInsulationCodeWarning"): "no",
    ("Compleo", "OtherError", "DcInsulationTestFailureOnCharge"): "no",
    ("Compleo", "OtherError", "DcInsulationTestFailureOnStart"): "yes",
    ("Compleo", "OtherError", "DcPsuConnectionFailure"): "yes",
    ("Compleo", "OtherError", "DoorClosed"): "no",
    ("Compleo", "OtherError", "DoorOpen"): "no",
    ("Compleo", "OtherError", "FuseError"): "yes",
    ("Compleo", "OtherError", "Inoperative"): "no",
    ("Compleo", "OtherError", "IsolationError"): "yes",
    ("Compleo", "OtherError", "IsolationWarning"): "yes",
    ("Compleo", "OtherError", "RCSensorTestRunning"): "yes",
    ("Compleo", "OtherError", "samEVSEIDMemoryFull"): "yes",
    ("Compleo", "OtherError", "samFirmwareCorrupted"): "yes",
    ("Compleo", "OtherError", "samInternalError"): "yes",
    ("Compleo", "OtherError", "samNotInitialized"): "yes",
    ("Compleo", "OtherError", "samNoTouchControllerComm"): "yes",
    ("Compleo", "OtherError", "samTransactionMemoryFull"): "yes",
    ("Compleo", "OtherError", "TemperatureSensorHighLimitViolation"): "yes",
    ("Compleo", "OtherError", "TemperatureSensorLowLimitViolation"): "yes",
    ("Compleo", "OtherError", "TemperatureSensorMissing"): "yes",
    ("Compleo", "PowerMeterFailure", ""): "yes",
    ("Compleo", "PowerSwitchFailure", ""): "yes",
    ("Compleo", "ReaderFailure", ""): "yes",

    # EV-BOX
    ("EV-Box", "ConnectorLockFailure", "13A cable connected."): "yes",
    ("EV-Box", "ConnectorLockFailure", "Lock not detected."): "yes",
    ("EV-Box", "ConnectorLockFailure", "No car attached."): "yes",
    ("EV-Box", "ConnectorLockFailure", ""): "yes",
    ("EV-Box", "Offline", ""): "yes",
    ("EV-Box", "OtherError", "Connectors with different software."): "yes",
    ("EV-Box", "PowerMeterFailure", "AC loss."): "yes",
    ("EV-Box", "PowerMeterFailure", "No meter value available."): "yes",
    ("EV-Box", "PowerMeterFailure", ""): "yes",

    # SCHNEIDER ELECTRIC
    ("Schneider Electric", "Offline", ""): "yes",
    ("Schneider Electric", "READER_FAILURE", "1"): "yes",
    ("Schneider Electric", "READER_FAILURE", "1 Rfid_Reader"): "yes",
    ("Schneider Electric", "OtherError", "3"): "yes",
    ("Schneider Electric", "OtherError", "3 Internal_Communication"): "yes",
    ("Schneider Electric", "ConnectorLockFailure", "4"): "no",
    ("Schneider Electric", "ConnectorLockFailure", "4 Outlet_Lock"): "no",
    ("Schneider Electric", "PowerSwitchFailure", "5"): "yes",
    ("Schneider Electric", "PowerSwitchFailure", "5 Contactor_State"): "yes",
    ("Schneider Electric", "OtherError", "6"): "no",
    ("Schneider Electric", "OtherError", "6 Surge_Arrestor"): "no",
    ("Schneider Electric", "OtherError", "7"): "no",
    ("Schneider Electric", "OtherError", "7 Anti-intrusion"): "no",
    ("Schneider Electric", "OtherError", "8"): "no",
    ("Schneider Electric", "OtherError", "8 Hardware_Configuration"): "no",
    ("Schneider Electric", "OtherError", "9"): "no",
    ("Schneider Electric", "OtherError", "9 Software_Configuration"): "no",
    ("Schneider Electric", "OtherError", "10"): "no",
    ("Schneider Electric", "OtherError", "10 Flap_Sensor"): "no",
    ("Schneider Electric", "GroundFailure", "11"): "yes",
    ("Schneider Electric", "GroundFailure", "11 Upstream_Protection_Devices"): "yes",
    ("Schneider Electric", "PowerMeterFailure", "12"): "no",
    ("Schneider Electric", "PowerMeterFailure", "12 Power_Meter_Communication"): "no",
    ("Schneider Electric", "OtherError", "14"): "no",
    ("Schneider Electric", "OtherError", "14 [Un]Plug_Process"): "no",
    ("Schneider Electric", "OtherError", "15"): "no",
    ("Schneider Electric", "OtherError", "15 Load tri-phasis compliancy"): "no",
    ("Schneider Electric", "OtherError", "16"): "no",
    ("Schneider Electric", "OtherError", "16 Plc Connection"): "no",
    ("Schneider Electric", "OtherError", "17"): "no",
    ("Schneider Electric", "OtherError", "17 Control_Pilot (CP) Signal conformity"): "no",
    ("Schneider Electric", "OtherError", "18"): "no",
    ("Schneider Electric", "OtherError", "18 Plug_Presence (PP) conformity"): "no",
    ("Schneider Electric", "OtherError", "19"): "no",
    ("Schneider Electric", "OtherError", "19 Charge_Alarm_EV_Disconnected"): "no",
    ("Schneider Electric", "OtherError", "20"): "no",
    ("Schneider Electric", "OtherError", "20 Charge_Alarm_ShortCut"): "no",
    ("Schneider Electric", "OverCurrentFailure", "21"): "no",
    ("Schneider Electric", "OverCurrentFailure", "21 Charge_Alarm_Overload"): "no",
    ("Schneider Electric", "OtherError", "22"): "yes",
    ("Schneider Electric", "OtherError", "22 Charge_Alarm_Ventilation_Not_Allowed"): "yes",
    ("Schneider Electric", "WeakSignal", "24"): "no",
    ("Schneider Electric", "WeakSignal", "24 Modem_Communication"): "no",
    ("Schneider Electric", "OtherError", "25"): "no",
    ("Schneider Electric", "OtherError", "25 Energy Reserve"): "no",

    # TECHNAGON
    ("Technagon", "ConnectorLockFailure", "Connector lock failure (unlocked)"): "no",
    ("Technagon", "ConnectorLockFailure", "Connector lock failure (locked)"): "no",
    ("Technagon", "ConnectorLockFailure", ""): "no",
    ("Technagon", "EVCommunicationError", "Charging."): "yes",
    ("Technagon", "EVCommunicationError", "Plugged."): "yes",
    ("Technagon", "EVCommunicationError", "Voltages: X/Y/Z"): "no",
    ("Technagon", "EVCommunicationError", ""): "no",
    ("Technagon", "GroundFailure", "RCD tripped"): "yes",
    ("Technagon", "GroundFailure", ""): "yes",
    ("Technagon", "Offline", ""): "yes",
    ("Technagon", "OtherError", ""): "yes",
    ("Technagon", "OtherError", "OverVoltageProtectionFailure"): "yes",
    ("Technagon", "OtherError", "EVSECommunicationError"): "yes",
    ("Technagon", "OtherError", "EVSECommunicationError Voltages: 0/0/0"): "yes",
    ("Technagon", "OverCurrentFailure", "MCB tripped"): "yes",
    ("Technagon", "OverCurrentFailure", ""): "yes",
    ("Technagon", "PowerMeterFailure", "S/N Error"): "yes",
    ("Technagon", "PowerMeterFailure", "S/N Error Energy meter serial number not valid"): "yes",
    ("Technagon", "PowerSwitchFailure", "Plugged."): "yes",
    ("Technagon", "PowerSwitchFailure", ""): "yes",
    ("Technagon", "UnderVoltage", "Voltages: X/Y/Z"): "no",
    ("Technagon", "WeakSignal", ""): "no",
    ("Technagon", "ReaderFailure", ""): "no",
    ("Technagon", "HighTemperature", ""): "no",

    # WIRELANE
    ("Wirelane", "ConnectorLockFailure", ""): "no",
    ("Wirelane", "connectorLockFailure", "Actuator emergency opener faulted"): "no",
    ("Wirelane", "ConnectorLockFailure", "Actuator unlocked while charging"): "yes",
    ("Wirelane", "ConnectorLockFailure", "Could not detect type 2 locking actuator"): "yes",
    ("Wirelane", "ConnectorLockFailure", "Locking without plug error"): "no",
    ("Wirelane", "ConnectorLockFailure", "temperature sensor"): "no",
    ("Wirelane", "ConnectorLockFailure", "Type 2 locking actuator stuck cannot unlock"): "no",
    ("Wirelane", "EVCommunicationError", ""): "yes",
    ("Wirelane", "evCommunicationError", "15118 communication error"): "yes",
    ("Wirelane", "EVCommunicationError", "Vehicle signals error"): "no",
    ("Wirelane", "GroundFailure", "RCD triggered"): "yes",
    ("Wirelane", "GroundFailure", "Residual current detected via sensor"): "no",
    ("Wirelane", "GroundFailure", ""): "no",
    ("Wirelane", "GroundFailure", "Ground check (PE) failed"): "yes",
    ("Wirelane", "GroundFailure", "RCMB error."): "yes",
    ("Wirelane", "HighTemperature", "Housing temperature too high - charging paused"): "no",
    ("Wirelane", "HighTemperature", "Temperature too high - charging paused"): "no",
    ("Wirelane", "HighTemperature", ""): "no",
    ("Wirelane", "HighTemperature", "Cannot read critical temperature sensor"): "yes",
    ("Wirelane", "HighTemperature", "Cannot read temperature sensor"): "yes",
    ("Wirelane", "HighTemperature", "High temperature alert."): "no",
    ("Wirelane", "internalError", "15118 module failure"): "yes",
    ("Wirelane", "internalError", "QCA7000 initialization failure"): "yes",
    ("Wirelane", "mode3Error", "Vehicle diode check failed - tamper detection"): "no",
    ("Wirelane", "mode3Error", "Vehicle signals error"): "no",
    ("Wirelane", "Offline", ""): "yes",
    ("Wirelane", "OtherError", "Possible CP and PR wiring issue."): "yes",
    ("Wirelane", "OtherError", "Temperature approaching limit - current reduced"): "no",
    ("Wirelane", "OtherError", ""): "no",
    ("Wirelane", "OtherError", "15118 authentication failed"): "no",
    ("Wirelane", "OtherError", "15118 authorization failed"): "no",
    ("Wirelane", "OtherError", "15118 certificate installation failed"): "no",
    ("Wirelane", "OtherError", "Car current is 10% more than expected."): "no",
    ("Wirelane", "OtherError", "Car current overload, charging stopped."): "no",
    ("Wirelane", "OtherError", "CP above 7.5V detected with STATE C/D."): "no",
    ("Wirelane", "OtherError", "Delaying FW update until transaction is stopped"): "no",
    ("Wirelane", "OtherError", "Diagnostics failed."): "no",
    ("Wirelane", "OtherError", "DLM Slave disconnected and not charging"): "no",
    ("Wirelane", "OtherError", "Failed init:"): "yes",
    ("Wirelane", "OtherError", "Firmware update failed."): "no",
    ("Wirelane", "OtherError", "Firmware update rolled back."): "no",
    ("Wirelane", "OtherError", "FW Update in progress"): "no",
    ("Wirelane", "OtherError", "FW update package manager fault"): "no",
    ("Wirelane", "OtherError", "Housing temperature approaching limit - charg(...)"): "no",
    ("Wirelane", "OtherError", "Internal communication error"): "no",
    ("Wirelane", "OtherError", "Low frequency detected, charging is paused"): "no",
    ("Wirelane", "OtherError", "Master and Slave have different SW version."): "no",
    ("Wirelane", "OtherError", "Message queue is full"): "no",
    ("Wirelane", "OtherError", "Not all DLM Slaves connected"): "no",
    ("Wirelane", "OtherError", "OCPP meter failure"): "yes",
    ("Wirelane", "OtherError", "Phase rotation failure."): "yes",
    ("Wirelane", "OtherError", "PR disconnected while car is connected."): "yes",
    ("Wirelane", "OtherError", "RCMB ext oscillator error."): "yes",
    ("Wirelane", "OtherError", "Relay temperature too high - charging current reduced"): "no",
    ("Wirelane", "OtherError", "Slave is unavailable (disconnected from Master)."): "yes",
    ("Wirelane", "OtherError", "State D detected, charging is paused"): "no",
    ("Wirelane", "OtherError", "System rebooting..."): "no",
    ("Wirelane", "OtherError", "Temperature reaches safety limit - emergency stop"): "no",
    ("Wirelane", "OtherError", "The charge point is tilted."): "no",
    ("Wirelane", "OtherError", "The charge point was tilted"): "no",
    ("Wirelane", "OtherError", "The controller on the Chargepoint has a defect."): "yes",
    ("Wirelane", "OtherError", "The current transformer has a defect."): "yes",
    ("Wirelane", "OverCurrentFailure", "MCB of domestic socket triggered"): "no",
    ("Wirelane", "OverCurrentFailure", "MCB of type 2 socket triggered"): "yes",
    ("Wirelane", "OverCurrentFailure", "RCD-MCB triggered from unique input"): "yes",
    ("Wirelane", "OverVoltage", "High voltage detected, charging is paused"): "no",
    ("Wirelane", "PowerMeterFailure", ""): "yes",
    ("Wirelane", "PowerMeterFailure", "No information received from ocpp meter"): "yes",
    ("Wirelane", "PowerMeterFailure", "No information received from second meter"): "yes",
    ("Wirelane", "PowerSwitchFailure", "Contactor welded"): "yes",
    ("Wirelane", "ReaderFailure", "RFID reader not communicating"): "yes",
    ("Wirelane", "ResetFailure", "Terminated transaction after reset! Power Outage?"): "no",
    ("Wirelane", "ResetFailure", ""): "no",
    ("Wirelane", "ResetFailure", "Unintended Reset - Power Outage?"): "no",
    ("Wirelane", "UnderVoltage", "Contactor not closed"): "yes",
    ("Wirelane", "UnderVoltage", "L1 voltage is missing"): "yes",
    ("Wirelane", "UnderVoltage", "Low voltage detected, charging is paused"): "no",
    ("Wirelane", "UnderVoltage", "There is no power on mains."): "no",
    ("Wirelane", "WeakSignal", ""): "no",
    ("Wirelane", "WeakSignal", "eth interface had 0 link up-down sequences."): "yes",
}


def lookup_escalation(manufacturer: str, ocpp_error: str, vendor_error: str) -> str | None:
    """Returns 'yes', 'no', or None if not in table."""
    vendor_error = vendor_error.strip()
    key = (manufacturer, ocpp_error, vendor_error)
    if key in ESCALATION_TABLE:
        return ESCALATION_TABLE[key]
    # Case-insensitive fallback for manufacturer
    for (m, o, v), result in ESCALATION_TABLE.items():
        if m.lower() == manufacturer.lower() and o == ocpp_error and v == vendor_error:
            return result
    log.warning(f"  NOT IN ESCALATION LIST: ({manufacturer}, {ocpp_error}, {vendor_error})")
    return None


# ---------------------------------------------------------------------------
# Per-loop tracking (cleared at start of each loop iteration)
# ---------------------------------------------------------------------------
soft_reset_done: set[str] = set()   # station names that got soft reset this loop
hard_reset_done: set[str] = set()   # station names that got hard reset this loop
station_reset_info: dict[str, str] = {}  # station -> info text about resets done


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------
async def save_cookies(context: BrowserContext) -> None:
    cookies = await context.cookies()
    with open(COOKIE_FILE, "w") as f:
        json.dump(cookies, f)
    log.info(f"Cookies saved to {COOKIE_FILE}")


async def load_cookies(context: BrowserContext) -> bool:
    if not os.path.exists(COOKIE_FILE):
        return False
    with open(COOKIE_FILE, "r") as f:
        cookies = json.load(f)
    await context.add_cookies(cookies)
    log.info(f"Cookies loaded from {COOKIE_FILE}")
    return True


# ---------------------------------------------------------------------------
# Basic UI helpers
# ---------------------------------------------------------------------------
async def safe_click(page: Page, selector: str, timeout: int = 5000) -> bool:
    """Click a selector, return True if clicked, False if not found."""
    try:
        await page.click(selector, timeout=timeout)
        return True
    except Exception:
        return False


async def wait_for_table_rows(page: Page, table_sel: str = "#open_issue_table") -> int:
    """Wait for a DataTable to finish loading. Returns row count."""
    log.info("  Waiting for table data to load...")
    for _ in range(30):
        rows = await page.query_selector_all(f"{table_sel} tbody tr")
        if rows:
            first_text = await rows[0].inner_text()
            if "Loading" not in first_text and "Processing" not in first_text:
                count = len(rows)
                log.info(f"  Table loaded -- {count} row(s) visible.")
                return count
        await page.wait_for_timeout(500)
    log.warning("  Table did not load within 15s.")
    return 0


# ---------------------------------------------------------------------------
# Fetch all alerts from the Current issues table (all pages)
# ---------------------------------------------------------------------------
async def fetch_all_alerts(page: Page) -> list[dict]:
    """
    Reads every row from the left-side "Current issues" table.
    Returns list of {id, station, error_text}.
    Table columns: Id | Issue information | Duration
    Issue information cell has: <b>STATION_NAME</b> then error text below.
    """
    alerts: list[dict] = []

    # Go to first page
    first_btn = await page.query_selector("#open_issue_table_paginate .first a, "
                                          "#open_issue_table_paginate li:first-child a")
    if first_btn:
        await first_btn.click()
        await page.wait_for_timeout(1000)

    page_num = 1
    while True:
        log.info(f"  Reading alert table page {page_num}...")
        await wait_for_table_rows(page)

        rows = await page.query_selector_all("#open_issue_table tbody tr")
        for row in rows:
            row_text = await row.inner_text()
            if "No records" in row_text or "Loading" in row_text:
                continue

            # Get all td cells
            cells = await row.query_selector_all("td")
            if len(cells) < 2:
                continue

            # First cell = ID
            id_text = (await cells[0].inner_text()).strip()

            # Second cell = Issue information (station name in <b>, error text below)
            info_cell = cells[1]
            b_tag = await info_cell.query_selector("b")
            station = ""
            if b_tag:
                station = (await b_tag.inner_text()).strip()

            full_info = (await info_cell.inner_text()).strip()
            # Error text is everything after the station name
            error_text = ""
            if station and station in full_info:
                after_station = full_info[full_info.index(station) + len(station):].strip()
                # Could have newline separating
                lines = after_station.split("\n")
                error_text = lines[0].strip() if lines else ""
            elif "\n" in full_info:
                parts = full_info.split("\n")
                error_text = parts[1].strip() if len(parts) > 1 else parts[0].strip()

            if id_text and station:
                alerts.append({"id": id_text, "station": station, "error_text": error_text})

        # Check for next page
        # Pagination: < 1 2 > with page numbers as links
        next_btn = await page.query_selector("#open_issue_table_paginate .next a, "
                                             "#open_issue_table_paginate li.next a")
        if next_btn:
            next_li = await next_btn.evaluate("el => el.closest('li')")
            parent_classes = await page.evaluate(
                "(el) => el.closest('li')?.className || ''", next_btn
            )
            if "disabled" in parent_classes:
                break
            await next_btn.click()
            await page.wait_for_timeout(1500)
            page_num += 1
        else:
            break

    log.info(f"  Total alerts collected: {len(alerts)}")
    return alerts


# ---------------------------------------------------------------------------
# Open detail panel for a specific issue
# ---------------------------------------------------------------------------
async def open_detail_for_issue(page: Page, issue_id: str) -> bool:
    """Click on an issue row to open its detail panel on the right side."""

    # Method 1: Use the dashboard's open_details() JS function
    try:
        result = await page.evaluate(
            f"typeof open_details !== 'undefined' ? (open_details({issue_id}), true) : false"
        )
        if result:
            await page.wait_for_timeout(2000)
            # Verify the detail panel loaded by checking for "Issue details: #..."
            header = await page.query_selector(f"text=Issue details: #{issue_id}")
            if header:
                log.info(f"  Detail panel opened via open_details({issue_id})")
                return True
            # Even without header match, panel may have loaded
            log.info(f"  open_details({issue_id}) called, checking panel...")
            await page.wait_for_timeout(1000)
            return True
    except Exception:
        pass

    # Method 2: Find and click the row in the table
    # First go to page 1
    first_btn = await page.query_selector("#open_issue_table_paginate .first a, "
                                          "#open_issue_table_paginate li:first-child a")
    if first_btn:
        await first_btn.click()
        await page.wait_for_timeout(1000)

    for attempt in range(20):  # up to 20 table pages
        await wait_for_table_rows(page)
        rows = await page.query_selector_all("#open_issue_table tbody tr")
        for row in rows:
            cells = await row.query_selector_all("td")
            if cells:
                cell_text = (await cells[0].inner_text()).strip()
                if cell_text == issue_id:
                    await row.click()
                    await page.wait_for_timeout(2000)
                    log.info(f"  Detail panel opened by clicking row #{issue_id}")
                    return True

        # Go to next table page
        next_btn = await page.query_selector("#open_issue_table_paginate .next a")
        if not next_btn:
            break
        parent_classes = await page.evaluate(
            "(el) => el.closest('li')?.className || ''", next_btn
        )
        if "disabled" in parent_classes:
            break
        await next_btn.click()
        await page.wait_for_timeout(1000)

    log.warning(f"  Could not open detail panel for #{issue_id}")
    return False


# ---------------------------------------------------------------------------
# Click a tab in the detail panel
# ---------------------------------------------------------------------------
async def click_detail_tab(page: Page, tab_name: str) -> bool:
    """
    Click a tab in the detail panel. Tabs are:
    Remote control | Error information | Previous errors | OCPP Logfiles | Authorization Log | Incident KPIs
    """
    # The tabs are <a> or <li> elements with text
    for selector in [
        f"a:has-text('{tab_name}')",
        f"li:has-text('{tab_name}') a",
        f"text={tab_name}",
    ]:
        try:
            el = await page.query_selector(selector)
            if el:
                await el.click()
                await page.wait_for_timeout(1500)
                log.info(f"  Clicked tab: {tab_name}")
                return True
        except Exception:
            continue
    log.warning(f"  Could not click tab: {tab_name}")
    return False


# ---------------------------------------------------------------------------
# Read error info from "Error information" tab
# ---------------------------------------------------------------------------
async def read_error_info(page: Page) -> tuple[str, str, str]:
    """
    Opens the Error information tab and reads:
    - Manufacturer (e.g. "DBT-CEV", "ABB")
    - Error information / OCPP error (e.g. "Offline", "OtherError")
    - Additional vendor information (e.g. "StopReason:GlobalInterlockFail")

    Returns (manufacturer, ocpp_error, vendor_error).

    HTML structure:
    <div class="col-xs-6">
        <b>Error information</b>:<br>Offline<br>
        <b>Additional vendor information</b>:<br>some_vendor_info
    </div>
    <div class="col-xs-6">
        <b>Manufacturer</b>:<br>DBT-CEV<br>
        <a href="mailto:...">...</a><br>
        <b>Model</b>:<br>KEREN V1
    </div>
    """
    await click_detail_tab(page, "Error information")

    try:
        result = await page.evaluate("""() => {
            const data = {manufacturer: '', ocpp_error: '', vendor_error: ''};
            const cols = document.querySelectorAll('.col-xs-6');
            for (const col of cols) {
                const html = col.innerHTML;
                const m1 = html.match(/Error information<\\/b>:\\s*<br\\s*\\/?>\\s*([^<]+)/i);
                if (m1) data.ocpp_error = m1[1].trim();
                const m2 = html.match(/Additional vendor information<\\/b>:\\s*<br\\s*\\/?>\\s*([^<]*)/i);
                if (m2) data.vendor_error = m2[1].trim();
                const m3 = html.match(/Manufacturer<\\/b>:\\s*<br\\s*\\/?>\\s*([^<]+)/i);
                if (m3) data.manufacturer = m3[1].trim();
            }
            return data;
        }""")
        if result:
            return (
                result.get("manufacturer", "").strip(),
                result.get("ocpp_error", "").strip(),
                result.get("vendor_error", "").strip(),
            )
    except Exception as e:
        log.warning(f"  Error reading Error information tab: {e}")

    return "", "", ""


# ---------------------------------------------------------------------------
# Check port status using connector icon CSS classes
# ---------------------------------------------------------------------------
async def check_port_status(page: Page) -> dict:
    """
    Reads connector icons in the detail panel header area.
    Each connector icon is an <i> with classes like:
        connector-type2 status-available  (blue = available)
        connector-type2 status-occupied   (green = occupied)
        connector-type2 status-error      (red = error)
        connector-type2 status-faulted    (red = faulted)

    Returns dict with:
        has_occupied: bool  (True if any port is green/occupied)
        has_error: bool     (True if any port is red/error)
        has_available: bool (True if any port is blue/available)
        ports: list of {name, status} for each port found
    """
    try:
        result = await page.evaluate("""() => {
            const info = {has_occupied: false, has_error: false, has_available: false, ports: []};
            const icons = document.querySelectorAll('i[class*="connector-"], i[class*="status-"]');
            for (const icon of icons) {
                const cls = icon.className;
                let status = 'unknown';
                if (cls.includes('status-occupied') || cls.includes('status-charging')) {
                    status = 'occupied';
                    info.has_occupied = true;
                } else if (cls.includes('status-available')) {
                    status = 'available';
                    info.has_available = true;
                } else if (cls.includes('status-error') || cls.includes('status-faulted')) {
                    status = 'error';
                    info.has_error = true;
                }
                // Try to get port name from tooltip
                const tooltip = icon.getAttribute('data-original-title') || '';
                let name = '';
                const nameMatch = tooltip.match(/<b>([^<]+)<\\/b>/);
                if (nameMatch) name = nameMatch[1];
                info.ports.push({name: name, status: status});
            }
            return info;
        }""")
        if result:
            log.info(f"  Port status: {result['ports']}")
            return result
    except Exception as e:
        log.warning(f"  Error checking port status: {e}")

    return {"has_occupied": False, "has_error": False, "has_available": False, "ports": []}


# ---------------------------------------------------------------------------
# Check Previous Errors tab
# ---------------------------------------------------------------------------
async def check_previous_errors_for_port(
    page: Page, issue_id: str, ocpp_error: str, vendor_error: str
) -> dict:
    """
    Opens the Previous errors tab and checks if this error (same Code + Vendor code)
    was already escalated TODAY.

    Only reads rows where "Occured at" contains today's date.
    Stops as soon as it hits a row with an older date (table is sorted newest first).

    Returns dict:
        port_name: str          - port name from first matching row
        already_escalated_today: bool - True if Escalated at has today's date
    """
    info = {"port_name": "", "already_escalated_today": False}

    today_str = date.today().strftime("%d.%m.%y")  # e.g. "07.10.26"
    log.info(f"  Checking Previous Errors for today ({today_str}), "
             f"Code='{ocpp_error}', Vendor='{vendor_error}'")

    # Step 1: Verify the detail panel is showing the correct issue
    panel_issue_id = await page.evaluate("""() => {
        const allText = document.body.innerText;
        const match = allText.match(/Issue details:\\s*#(\\d+)/);
        return match ? match[1] : '';
    }""")
    if panel_issue_id and panel_issue_id != issue_id:
        log.warning(f"  Panel shows #{panel_issue_id} but expected #{issue_id} -- re-opening")
        await open_detail_for_issue(page, issue_id)

    # Step 2: Click the Previous errors tab and wait for fresh data
    await click_detail_tab(page, "Previous errors")

    # Wait a moment for the AJAX request to start
    await page.wait_for_timeout(500)

    # Now wait for loading/processing to finish (the table takes ~1 second to load)
    for _ in range(20):
        state = await page.evaluate("""() => {
            const tables = document.querySelectorAll('table');
            for (const table of tables) {
                if (table.id === 'open_issue_table') continue;
                const headers = table.querySelectorAll('thead th');
                let isPrevTable = false;
                for (const h of headers) {
                    if (h.textContent.trim() === 'Charge point') { isPrevTable = true; break; }
                }
                if (!isPrevTable) continue;
                const trs = table.querySelectorAll('tbody tr');
                if (trs.length === 0) return 'loading';
                const txt = trs[0].textContent;
                if (txt.includes('Loading') || txt.includes('Processing')) return 'loading';
                return 'ready';
            }
            return 'no_table';
        }""")
        if state == 'ready' or state == 'no_table':
            break
        await page.wait_for_timeout(500)

    # Extra wait to make sure data is fully rendered
    await page.wait_for_timeout(1000)

    try:
        # Read ONLY today's rows from the Previous Errors table
        # Pass today_str into JavaScript so filtering happens in the browser
        rows_data = await page.evaluate("""(todayStr) => {
            const results = [];
            const allTables = document.querySelectorAll('table');
            for (const table of allTables) {
                if (table.id === 'open_issue_table') continue;

                const headers = table.querySelectorAll('thead th');
                let isPrevTable = false;
                for (const h of headers) {
                    if (h.textContent.trim() === 'Charge point') { isPrevTable = true; break; }
                }
                if (!isPrevTable) continue;

                const trs = table.querySelectorAll('tbody tr');
                for (const row of trs) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 7) continue;

                    const occurred = cells[3].textContent.trim();

                    // ONLY read rows where Occurred at contains today's date
                    if (!occurred.includes(todayStr)) continue;

                    results.push({
                        port: cells[0].textContent.trim(),
                        code: cells[1].textContent.trim(),
                        vendor: cells[2].textContent.trim(),
                        occurred: occurred,
                        solved: cells[4].textContent.trim(),
                        escalated: cells[5].textContent.trim(),
                        action: cells[6].textContent.trim(),
                    });
                }
            }
            return results;
        }""", today_str)

        if rows_data:
            log.info(f"  Found {len(rows_data)} row(s) from today:")
            for i, row in enumerate(rows_data):
                log.info(f"    Row {i+1}: Port='{row['port']}' Code='{row['code']}' "
                         f"Vendor='{row['vendor']}' Occurred='{row['occurred']}' "
                         f"Escalated='{row['escalated']}' Action='{row['action']}'")

                code = row.get("code", "").strip()
                vendor = row.get("vendor", "").strip()
                escalated = row.get("escalated", "").strip()
                port = row.get("port", "").strip()

                # Match by Code and Vendor code
                if code == ocpp_error and vendor == vendor_error:
                    if not info["port_name"] and port:
                        info["port_name"] = port

                    if escalated and today_str in escalated:
                        info["already_escalated_today"] = True
                        log.info(f"  MATCH: Port '{port}' Code='{code}' "
                                 f"Vendor='{vendor}' escalated today at {escalated}")
                        return info
                    else:
                        log.info(f"    Today's match but NOT escalated: Port='{port}' "
                                 f"Code='{code}' Escalated='{escalated}'")
        else:
            log.info("  No rows from today in Previous Errors table.")

    except Exception as e:
        log.warning(f"  Error reading Previous Errors tab: {e}")

    log.info(f"  Previous Errors result: port='{info['port_name']}', "
             f"escalated_today={info['already_escalated_today']}")
    return info


# ---------------------------------------------------------------------------
# ACTIONS: Soft Reset
# ---------------------------------------------------------------------------
async def do_soft_reset(page: Page, station: str) -> bool:
    """
    Click Remote control tab -> click "On Idle reset (Soft)" button ->
    confirm in dialog by clicking red "On Idle reset (Soft)" button.
    """
    if station in soft_reset_done:
        log.info(f"  Soft reset already done for {station} this loop -- skipping.")
        return False

    log.info(f"  SOFT RESET -> {station}")

    if DRY_RUN:
        log.info(f"  [DRY RUN] WOULD: click Remote control tab -> "
                 f"click 'On Idle reset (Soft)' -> confirm in dialog")
        soft_reset_done.add(station)
        return True

    # Click Remote control tab
    await click_detail_tab(page, "Remote control")
    await page.wait_for_timeout(500)

    # Click the "On Idle reset (Soft)" button in the Reset charging station section
    clicked = await safe_click(page, "button:has-text('On Idle reset (Soft)')", timeout=5000)
    if not clicked:
        # Try alternate selectors
        clicked = await safe_click(page, "text=On Idle reset (Soft)", timeout=3000)
    if not clicked:
        log.warning(f"  Could not find 'On Idle reset (Soft)' button for {station}")
        return False

    # Wait for confirmation dialog
    await page.wait_for_timeout(1000)

    # Click the red confirmation button in the dialog
    # Dialog title: "On Idle (Soft) reset of charging station"
    # Button text: "On Idle reset (Soft)"
    try:
        # The confirmation button is inside a modal dialog
        confirm_btn = page.locator(".modal-dialog button:has-text('On Idle reset (Soft)'),"
                                   " .modal-content button:has-text('On Idle reset (Soft)')")
        await confirm_btn.click(timeout=5000)
        log.info(f"  Soft Reset confirmed -> {station}")
        soft_reset_done.add(station)
        await page.wait_for_timeout(2000)
        return True
    except Exception:
        # Fallback: click any visible red button with matching text
        try:
            await page.evaluate("""() => {
                const btns = document.querySelectorAll('.modal button, .modal-dialog button');
                for (const btn of btns) {
                    if (btn.textContent.includes('On Idle reset') &&
                        btn.textContent.includes('Soft')) {
                        btn.click();
                        return;
                    }
                }
            }""")
            log.info(f"  Soft Reset confirmed (fallback) -> {station}")
            soft_reset_done.add(station)
            await page.wait_for_timeout(2000)
            return True
        except Exception as e:
            log.warning(f"  Could not confirm soft reset dialog: {e}")
            return False


# ---------------------------------------------------------------------------
# ACTIONS: Hard Reset
# ---------------------------------------------------------------------------
async def do_hard_reset(page: Page, station: str) -> bool:
    """
    Click Remote control tab -> click "Immediate reset (Hard)" button ->
    confirm in dialog by clicking red "Immediate reset (Hard)" button.
    """
    if station in hard_reset_done:
        log.info(f"  Hard reset already done for {station} this loop -- skipping.")
        return False

    log.info(f"  HARD RESET -> {station}")

    if DRY_RUN:
        log.info(f"  [DRY RUN] WOULD: click Remote control tab -> "
                 f"click 'Immediate reset (Hard)' -> confirm in dialog")
        hard_reset_done.add(station)
        return True

    # Click Remote control tab
    await click_detail_tab(page, "Remote control")
    await page.wait_for_timeout(500)

    # Click the "Immediate reset (Hard)" button
    clicked = await safe_click(page, "button:has-text('Immediate reset (Hard)')", timeout=5000)
    if not clicked:
        clicked = await safe_click(page, "text=Immediate reset (Hard)", timeout=3000)
    if not clicked:
        log.warning(f"  Could not find 'Immediate reset (Hard)' button for {station}")
        return False

    # Wait for confirmation dialog
    await page.wait_for_timeout(1000)

    # Click the red confirmation button in the dialog
    # Dialog title: "Immediate (Hard) reset of charging station"
    # Button text: "Immediate reset (Hard)"
    try:
        confirm_btn = page.locator(".modal-dialog button:has-text('Immediate reset (Hard)'),"
                                   " .modal-content button:has-text('Immediate reset (Hard)')")
        await confirm_btn.click(timeout=5000)
        log.info(f"  Hard Reset confirmed -> {station}")
        hard_reset_done.add(station)
        await page.wait_for_timeout(2000)
        return True
    except Exception:
        try:
            await page.evaluate("""() => {
                const btns = document.querySelectorAll('.modal button, .modal-dialog button');
                for (const btn of btns) {
                    if (btn.textContent.includes('Immediate reset') &&
                        btn.textContent.includes('Hard')) {
                        btn.click();
                        return;
                    }
                }
            }""")
            log.info(f"  Hard Reset confirmed (fallback) -> {station}")
            hard_reset_done.add(station)
            await page.wait_for_timeout(2000)
            return True
        except Exception as e:
            log.warning(f"  Could not confirm hard reset dialog: {e}")
            return False


# ---------------------------------------------------------------------------
# ACTIONS: Escalate to third party
# ---------------------------------------------------------------------------
async def do_escalate(page: Page, issue_id: str, station: str, reason: str,
                      extra_message: str = "") -> None:
    """
    Click "Escalate to third party" button at the top of the detail panel.
    A modal opens with a rich text editor pre-filled with template.
    If extra_message is given, type it in the editor area under
    "Performed activities by ChargePoint Austria:".
    Then confirm by clicking the escalate button in the modal.
    """
    log.info(f"  ACTION: ESCALATE | Issue #{issue_id} | {station}")
    log.info(f"  Reason: {reason}")
    if extra_message:
        log.info(f"  Message to add: {extra_message}")

    if DRY_RUN:
        log.info("  [DRY RUN] WOULD: click 'Escalate to third party' button")
        if extra_message:
            log.info(f"  [DRY RUN] WOULD: type '{extra_message}' in escalation modal editor")
        log.info("  [DRY RUN] WOULD: confirm escalation in modal")
        return

    # Click the "Escalate to third party" button (green button at top)
    clicked = await safe_click(page, "button:has-text('Escalate to third party')", timeout=5000)
    if not clicked:
        clicked = await safe_click(page, "a:has-text('Escalate to third party')", timeout=3000)
    if not clicked:
        log.warning("  Could not click 'Escalate to third party' button")
        return

    # Wait for modal to appear
    await page.wait_for_timeout(2000)

    # Type message in the rich text editor if needed
    if extra_message:
        try:
            # The modal has a rich text editor (contenteditable div or note-editable)
            editor = await page.query_selector(
                ".modal .note-editable, "
                ".modal [contenteditable='true'], "
                ".modal textarea, "
                ".modal .ql-editor"
            )
            if editor:
                await editor.click()
                await page.keyboard.press("End")
                await page.keyboard.press("Enter")
                await page.keyboard.type(extra_message)
                log.info(f"  Typed message in editor: {extra_message}")
            else:
                log.warning("  Could not find editor in escalation modal")
        except Exception as e:
            log.warning(f"  Could not type message: {e}")

    # Confirm escalation - click the button in the modal
    try:
        # Try multiple ways to find the confirm button
        confirm = page.locator(".modal button:has-text('Escalate to third party')").last
        await confirm.click(timeout=5000)
        log.info("  Escalation confirmed.")
    except Exception:
        try:
            await page.evaluate("""() => {
                const btns = document.querySelectorAll('.modal button, .modal-footer button');
                for (let i = btns.length - 1; i >= 0; i--) {
                    const txt = btns[i].textContent.trim().toLowerCase();
                    if (txt.includes('escalate')) {
                        btns[i].click();
                        return;
                    }
                }
            }""")
            log.info("  Escalation confirmed (fallback).")
        except Exception as e:
            log.warning(f"  Could not confirm escalation: {e}")

    await page.wait_for_timeout(2000)


# ---------------------------------------------------------------------------
# ACTIONS: Acknowledge
# ---------------------------------------------------------------------------
async def do_acknowledge(page: Page, issue_id: str, station: str, reason: str) -> None:
    """Click the "Acknowledged" button at the top of the detail panel."""
    log.info(f"  ACTION: ACKNOWLEDGE | Issue #{issue_id} | {station}")
    log.info(f"  Reason: {reason}")

    if DRY_RUN:
        log.info("  [DRY RUN] WOULD: click 'Acknowledged' button")
        return

    # Click "Acknowledged" button (blue/teal button at top)
    clicked = await safe_click(page, "button:has-text('Acknowledged')", timeout=5000)
    if not clicked:
        clicked = await safe_click(page, "a:has-text('Acknowledged')", timeout=3000)
    if not clicked:
        log.warning("  Could not click 'Acknowledged' button")
        return

    await page.wait_for_timeout(1500)
    log.info("  Acknowledged.")


# ---------------------------------------------------------------------------
# Check if an alert is still in the open issues table
# ---------------------------------------------------------------------------
async def alert_still_open(page: Page, issue_id: str) -> bool:
    """Check if issue_id still appears in the current issues table."""
    # Reload the page to get fresh data
    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    try:
        await page.wait_for_selector("#open_issue_table", timeout=10000)
    except Exception:
        pass
    await wait_for_table_rows(page)

    # Check all pages of the issues table
    first_btn = await page.query_selector("#open_issue_table_paginate .first a, "
                                          "#open_issue_table_paginate li:first-child a")
    if first_btn:
        await first_btn.click()
        await page.wait_for_timeout(1000)

    while True:
        rows = await page.query_selector_all("#open_issue_table tbody tr")
        for row in rows:
            cells = await row.query_selector_all("td")
            if cells:
                cell_text = (await cells[0].inner_text()).strip()
                if cell_text == issue_id:
                    return True

        # Next page
        next_btn = await page.query_selector("#open_issue_table_paginate .next a")
        if not next_btn:
            break
        parent_classes = await page.evaluate(
            "(el) => el.closest('li')?.className || ''", next_btn
        )
        if "disabled" in parent_classes:
            break
        await next_btn.click()
        await page.wait_for_timeout(1000)

    return False


# ---------------------------------------------------------------------------
# Reset cycle: soft reset -> wait 5 min -> hard reset -> wait 5 min
# ---------------------------------------------------------------------------
async def do_reset_cycle(page: Page, issue_id: str, station: str) -> str:
    """
    Perform reset cycle for a station:
    1. Soft reset (if not already done this loop)
    2. Wait 5 minutes
    3. Check if alert cleared
    4. Hard reset (if not already done this loop)
    5. Wait 5 minutes
    6. Check if alert cleared

    Returns: 'cleared' or 'still_open'
    """
    both_done = (station in soft_reset_done and station in hard_reset_done)
    if both_done:
        log.info(f"  Station {station} already had both resets this loop -- skipping cycle.")
        return "still_open"

    # --- Soft Reset ---
    if station not in soft_reset_done:
        # Need to open the detail again to access Remote control tab
        await open_detail_for_issue(page, issue_id)
        sent = await do_soft_reset(page, station)
        if sent:
            if DRY_RUN:
                log.info(f"  [DRY RUN] WOULD wait {WAIT_MINUTES} min after soft reset.")
                log.info(f"  [DRY RUN] Assuming alert still open.")
            else:
                log.info(f"  Waiting {WAIT_MINUTES} minutes after soft reset...")
                await asyncio.sleep(WAIT_MINUTES * 60)

                # Check if alert cleared
                if not await alert_still_open(page, issue_id):
                    log.info("  Alert CLEARED after soft reset!")
                    return "cleared"
                log.info("  Alert still open after soft reset.")

    # --- Hard Reset ---
    if station not in hard_reset_done:
        # Re-open detail panel (page may have been reloaded)
        await open_detail_for_issue(page, issue_id)
        sent = await do_hard_reset(page, station)
        if sent:
            if DRY_RUN:
                log.info(f"  [DRY RUN] WOULD wait {WAIT_MINUTES} min after hard reset.")
                log.info(f"  [DRY RUN] Assuming alert still open.")
            else:
                log.info(f"  Waiting {WAIT_MINUTES} minutes after hard reset...")
                await asyncio.sleep(WAIT_MINUTES * 60)

                # Check if alert cleared
                if not await alert_still_open(page, issue_id):
                    log.info("  Alert CLEARED after hard reset!")
                    return "cleared"
                log.info("  Alert still open after hard reset.")

    station_reset_info[station] = "Reset and restart already performed"
    return "still_open"


# ---------------------------------------------------------------------------
# CORE DECISION: Process one alert
# ---------------------------------------------------------------------------
async def process_alert(page: Page, alert: dict) -> None:
    """
    Process a single alert following the exact workflow:

    1. Open the error detail panel
    2. Go to Error information tab, read OCPP error + vendor error + manufacturer
    3. If OCPP error is "Offline":
       -> Soft reset + Escalate directly (ALWAYS, no list check, no previous errors check)
    4. For non-offline errors:
       a. Check port status (connector icon classes)
       b. Go to Previous errors tab, check if same error on same port was escalated today
       c. Look up escalation list (not in list = treat as "yes")
       d. If port is OCCUPIED:
          - Already escalated today for this port? -> Acknowledge
          - List says YES -> Escalate with "Station is already occupied" message
          - List says NO -> Acknowledge
       e. If port is NOT occupied:
          - Already escalated today for this port? -> Acknowledge
          - Station already reset this loop? -> Escalate (YES) or Acknowledge (NO)
          - Otherwise: Reset cycle (soft->5min->hard->5min)
          - If cleared -> Done
          - If still open: YES -> Escalate, NO -> Acknowledge
    """
    issue_id = alert["id"]
    station = alert["station"]
    error_from_list = alert["error_text"]

    log.info(f"\n{'='*60}")
    log.info(f"Issue #{issue_id}  |  Station: {station}")
    log.info(f"  Error from table: {error_from_list}")

    # Step 1: Open detail panel
    opened = await open_detail_for_issue(page, issue_id)
    if not opened:
        log.warning(f"  SKIP: Could not open detail panel for #{issue_id}")
        return

    # Step 2: Read error info from Error information tab
    manufacturer, ocpp_error, vendor_error = await read_error_info(page)
    log.info(f"  Manufacturer : '{manufacturer}'")
    log.info(f"  OCPP Error   : '{ocpp_error}'")
    log.info(f"  Vendor Error : '{vendor_error}'")

    # ====================================================================
    # Step 3: OFFLINE -> Always soft reset + escalate
    # No list check, no previous errors check
    # ====================================================================
    if ocpp_error.lower() == "offline":
        log.info("  ** OFFLINE ERROR -> Soft Reset + Escalate (always) **")

        if station not in soft_reset_done:
            await do_soft_reset(page, station)
        else:
            log.info(f"  Soft reset already done for {station} this loop.")

        await do_escalate(page, issue_id, station, "Station is offline")
        return

    # ====================================================================
    # Step 4a: Check port status
    # ====================================================================
    port_info = await check_port_status(page)
    occupied = port_info["has_occupied"]
    log.info(f"  Any port occupied: {occupied}")

    # ====================================================================
    # Step 4b: Check Previous Errors for this error on this port
    # ====================================================================
    prev = await check_previous_errors_for_port(page, issue_id, ocpp_error, vendor_error)
    log.info(f"  Port name: '{prev['port_name']}'")
    log.info(f"  Already escalated today (this port, this error): "
             f"{prev['already_escalated_today']}")

    # ====================================================================
    # Step 4c: Look up escalation list
    # ====================================================================
    escalation = lookup_escalation(manufacturer, ocpp_error, vendor_error)
    if escalation is None:
        log.info("  Not in escalation list -> treating as YES (needs escalation)")
        escalation = "yes"
    else:
        log.info(f"  Escalation list says: {escalation}")

    # ====================================================================
    # Step 4d: BRANCH A - PORT IS OCCUPIED
    # ====================================================================
    if occupied:
        log.info("  BRANCH: Port is OCCUPIED")

        # Already escalated today for this port+error? -> Acknowledge
        if prev["already_escalated_today"]:
            log.info("  -> Already escalated today for this port -> ACKNOWLEDGE")
            # Re-open detail to access Acknowledged button
            await open_detail_for_issue(page, issue_id)
            await do_acknowledge(page, issue_id, station,
                                 "Already escalated today for this port (occupied)")
            return

        if escalation == "yes":
            log.info("  -> List says YES -> ESCALATE with 'Station is already occupied'")
            await open_detail_for_issue(page, issue_id)
            await do_escalate(page, issue_id, station,
                              "Error needs escalation, port occupied",
                              extra_message="Station is already occupied")
            return
        else:  # escalation == "no"
            log.info("  -> List says NO -> ACKNOWLEDGE")
            await open_detail_for_issue(page, issue_id)
            await do_acknowledge(page, issue_id, station,
                                 "List says no escalation, port is occupied")
            return

    # ====================================================================
    # Step 4e: BRANCH B - PORT IS NOT OCCUPIED
    # ====================================================================
    log.info("  BRANCH: Port is NOT occupied")

    # Already escalated today for this port+error? -> Acknowledge
    if prev["already_escalated_today"]:
        log.info("  -> Already escalated today for this port -> ACKNOWLEDGE")
        await open_detail_for_issue(page, issue_id)
        await do_acknowledge(page, issue_id, station,
                             "Already escalated today for this port (not occupied)")
        return

    # Station already had both resets this loop (from another error on same station)?
    if station in soft_reset_done and station in hard_reset_done:
        log.info(f"  -> Station {station} already reset this loop for another error.")
        if escalation == "yes":
            log.info("  -> List says YES -> ESCALATE (already reset, still failing)")
            info_text = station_reset_info.get(station, "")
            await open_detail_for_issue(page, issue_id)
            await do_escalate(page, issue_id, station,
                              "Already reset this loop, error persists",
                              extra_message=info_text)
        else:
            log.info("  -> List says NO -> ACKNOWLEDGE (already reset)")
            await open_detail_for_issue(page, issue_id)
            await do_acknowledge(page, issue_id, station,
                                 "Already reset this loop, list says no escalation")
        return

    # Perform reset cycle: soft -> wait 5 min -> hard -> wait 5 min
    log.info("  -> Starting reset cycle...")
    result = await do_reset_cycle(page, issue_id, station)

    if result == "cleared":
        log.info("  -> Alert cleared after reset cycle. Done!")
        return

    # Still open after resets
    # Re-open detail panel (page was reloaded during alert_still_open check)
    await open_detail_for_issue(page, issue_id)

    if escalation == "yes":
        log.info("  -> Still open after resets, list says YES -> ESCALATE")
        await do_escalate(page, issue_id, station,
                          "Soft + hard reset done, error persists")
    else:
        log.info("  -> Still open after resets, list says NO -> ACKNOWLEDGE")
        await do_acknowledge(page, issue_id, station,
                             "Resets done, list says no escalation needed")


# ---------------------------------------------------------------------------
# MAIN LOOP
# ---------------------------------------------------------------------------
async def run(dashboard_url: str) -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()

        # Load saved cookies if available
        await load_cookies(context)
        page = await context.new_page()

        log.info(f"Navigating to {dashboard_url}")
        await page.goto(dashboard_url, wait_until="domcontentloaded")

        # Check if already logged in
        try:
            await page.wait_for_selector("#open_issue_table", timeout=10000)
            log.info("Dashboard loaded via saved cookies.")
        except Exception:
            log.info("Not logged in. Please log in manually in the browser window...")
            log.info("Waiting up to 2 minutes for login...")
            await page.wait_for_selector("#open_issue_table", timeout=120000)
            log.info("Login successful -- saving cookies...")
            await save_cookies(context)

        # ==================================================================
        # MAIN LOOP -- runs indefinitely (DRY RUN exits after one loop)
        # ==================================================================
        loop_count = 0
        while True:
            loop_count += 1
            log.info(f"\n{'#'*60}")
            log.info(f"  LOOP {loop_count} -- scanning for alerts")
            log.info(f"{'#'*60}")

            # Clear per-loop tracking
            soft_reset_done.clear()
            hard_reset_done.clear()
            station_reset_info.clear()

            # Wait for table to load
            await wait_for_table_rows(page)

            # Fetch all alerts from all pages
            all_alerts = await fetch_all_alerts(page)

            if not all_alerts:
                log.info("  No alerts found. Waiting 60 seconds...")
                await page.wait_for_timeout(60000)
                await page.reload(wait_until="domcontentloaded")
                try:
                    await page.wait_for_selector("#open_issue_table", timeout=15000)
                except Exception:
                    pass
                continue

            # Log summary
            log.info(f"\n  Total alerts: {len(all_alerts)}")
            station_counts = Counter(a["station"] for a in all_alerts)
            log.info("  Station summary:")
            for st, cnt in station_counts.most_common():
                marker = " << MULTIPLE ERRORS" if cnt > 1 else ""
                log.info(f"    {st}: {cnt} alert(s){marker}")

            # Group alerts by station so we reset each station only once
            by_station: dict[str, list[dict]] = defaultdict(list)
            for alert in all_alerts:
                by_station[alert["station"]].append(alert)

            # Process station by station
            for station, station_alerts in by_station.items():
                log.info(f"\n  --- Station: {station} "
                         f"({len(station_alerts)} alert(s)) ---")
                for alert in station_alerts:
                    try:
                        await process_alert(page, alert)
                    except Exception as e:
                        log.error(f"  ERROR processing #{alert['id']}: {e}")
                        import traceback
                        log.error(traceback.format_exc())
                        continue

            log.info(f"\n  Loop {loop_count} complete.")
            log.info(f"  Stations soft-reset this loop: "
                     f"{soft_reset_done if soft_reset_done else 'none'}")
            log.info(f"  Stations hard-reset this loop: "
                     f"{hard_reset_done if hard_reset_done else 'none'}")

            if DRY_RUN:
                log.info("\n  DRY RUN complete -- exiting after one loop.")
                log.info("  Review the log above. If everything looks correct,")
                log.info("  set DRY_RUN = False on line 29 to go live.")
                break

            # Wait before next scan
            log.info("  Waiting 30 seconds before next scan...")
            await page.wait_for_timeout(30000)

            # Reload page for fresh data
            await page.reload(wait_until="domcontentloaded")
            try:
                await page.wait_for_selector("#open_issue_table", timeout=15000)
            except Exception:
                log.warning("  Page reload issue -- navigating to URL again...")
                await page.goto(dashboard_url, wait_until="domcontentloaded")
                try:
                    await page.wait_for_selector("#open_issue_table", timeout=30000)
                except Exception:
                    log.error("  Could not reload dashboard!")

        await browser.close()
        log.info("\nScript ended.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OCPP Alert Automation for be.ENERGISED")
    parser.add_argument(
        "--url",
        default="https://community.beenergised.cloud/infrastructure/cp/operation/dashboard",
        help="Dashboard URL",
    )
    args = parser.parse_args()
    asyncio.run(run(args.url))