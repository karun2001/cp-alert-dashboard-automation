/**
 * OCPP / Vendor Error escalation checker — Hardware Manufacturer aware.
 * Source: CheckEscalation.xlsx (10 manufacturer sheets)
 *
 * @param hardware   - Hardware manufacturer name (case-insensitive)
 * @param ocppError  - OCPP error code string
 * @param vendorError - Vendor-specific error string or number (pass as string)
 * @returns true  → escalate to support
 *          false → no escalation needed
 *          null  → unknown manufacturer
 */
export function shouldEscalate(
  hardware: string,
  ocppError: string,
  vendorError: string
): boolean | null {
  switch (hardware.trim().toLowerCase()) {
    case "abb":
      return checkABB(ocppError, vendorError);
    case "alfen":
      return checkAlfen(ocppError, vendorError);
    case "alpitronic":
      return checkAlpitronic(ocppError, vendorError);
    case "circontrol":
      return checkCircontrol(ocppError, vendorError);
    case "dbt":
      return checkDBT(ocppError, vendorError);
    case "compleo":
      return checkCompleo(ocppError, vendorError);
    case "ev-box":
    case "evbox":
      return checkEVBox(ocppError, vendorError);
    case "schneider electric":
    case "schneider":
      return checkSchneider(ocppError, vendorError);
    case "technagon":
      return checkTechnagon(ocppError, vendorError);
    case "wirelane":
      return checkWirelane(ocppError, vendorError);
    default:
      return null; // unknown manufacturer
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — O(1) lookup in a Set of "ocppError|vendorError" compound keys
// ─────────────────────────────────────────────────────────────────────────────
function key(ocpp: string, vendor: string): string {
  return `${ocpp}|${vendor}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// ABB  (276 rows)
// ═════════════════════════════════════════════════════════════════════════════
const ABB_ESCALATE = new Set<string>([
  // Offline
  key("Offline", "(Leer)"),

  // ChargeStopped
  key("OtherError", "ChargeStopped:ChargerError"),
  key("OtherError", "ChargeStopped:IsolationTestFailed"),

  // ACS
  key("OtherError", "StopReason: AcsErrorAlignment"),
  key("OtherError", "StopReason:AcsErrorExtending"),
  key("OtherError", "StopReason: AcsErrorRetracting"),
  key("OtherError", "StopReason: AcsExtendedTimeout"),
  key("OtherError", "StopReason: AcsRetractedTimeout"),

  // Blocked / Board / Cable checks
  key("OtherError", "StopReason:Blocked"),
  key("OtherError", "StopReason:BoardPowerSupplyError"),
  key("OtherError", "StopReason:CableCheckCurrentRunning"),
  key("OtherError", "StopReason:CableCheckFailed"),
  key("OtherError", "StopReason:CableCheckVoltageNotDropping"),
  key("OtherError", "StopReason:CableCheckVoltageTooHigh"),
  key("OtherError", "StopReason:CableCheckVoltageTooLow"),
  key("OtherError", "StopReason:CableError"),

  // Charger cabinet / cable cooler
  key("OtherError", "StopReason: ChargerCabinetOvp"),
  key("OtherError", "StopReason: ChargerCableCoolerFailure"),
  key("OtherError", "StopReason: ChargerCanCommunicationLost"),

  // Charger connector / contactors
  key("OtherError", "StopReason:ChargerConnectorPresenceLost"),
  key("OtherError", "StopReason:ChargerContactorsProblem"),
  key("OtherError", "StopReason:ChargerContactorsProblem on outlet while charging"),

  // Charger errors
  key("OtherError", "StopReason:ChargerError"),
  key("OtherError", "StopReason:ChargerError detected. X V"),
  key("OtherError", "StopReason:ChargerError modules disabled"),
  key("OtherError", "StopReason:ChargerErrorCurrentDifference"),
  key("OtherError", "StopReason:ChargerErrorCurrentDifference (CC) detection"),
  key("OtherError", "StopReason:ChargerErrorCurrentDifference detected. req:X actual:Y"),
  key("OtherError", "StopReason:ChargerErrorCurrentDifference pwm:100%"),
  key("OtherError", "StopReason:ChargerMaxVoltage modules disabled"),

  // MCB / neutral / outlet detection
  key("OtherError", "StopReason:ChargerMcbTripped"),
  key("OtherError", "StopReason:ChargerMcbTripped on outlet while charging"),
  key("OtherError", "StopReason: ChargerNeutralMismatch"),
  key("OtherError", "StopReason:ChargerOutletDetectionError"),

  // RCD / temperature too high / voltage drop
  key("OtherError", "StopReason:ChargerRcdTripped"),
  key("OtherError", "StopReason: ChargerRcdCloseError"),
  key("OtherError", "StopReason:ChargerTemperatureError too high"),
  key("OtherError", "StopReason:ChargerVoltageDrop"),

  // Connector errors
  key("OtherError", "StopReason:ConnectorError"),
  key("OtherError", "StopReason:ConnectorError pwm:5%"),
  key("OtherError", "StopReason:ConnectorPilotError"),
  key("OtherError", "StopReason:ConnectorPilotShortCircuit"),
  key("OtherError", "StopReason:ConnectorTemperatureError"),

  // Expired / GB protocol
  key("OtherError", "StopReason:Expired"),
  key("OtherError", "StopReason:GbProtocolBemTimeoutCrmNotIdentifiable"),

  // Global interlock / IMI
  key("OtherError", "StopReason:GlobalInterlockFail"),
  key("OtherError", "StopReason:GlobalInterlockFail modules disabled"),
  key("OtherError", "StopReason:GlobalInterlockFail with IMI, cleared all other errors"),
  key("OtherError", "StopReason:ImiDisconnectedFromDcbus"),

  // Server / invalid
  key("OtherError", "StopReason: InvalidOnServer"),

  // Isolation test — modules disabled / with IMI
  key("OtherError", "StopReason:IsolationTestFailed modules disabled"),
  key("OtherError", "StopReason:IsolationTestFailed with IMI, cleared all other errors"),

  // Lock errors
  key("OtherError", "StopReason:LockError"),
  key("OtherError", "StopReason:LockError lock connector"),
  key("OtherError", "StopReason: LockTampering"),

  // No error — modules disabled
  key("OtherError", "StopReason:NoError modules disabled"),

  // OCM errors
  key("OtherError", "StopReason: OcmNotAlive"),
  key("OtherError", "StopReason: OcmInterlockVerificationError"),
  key("OtherError", "StopReason: OcmCableRatingMismatch"),
  key("OtherError", "StopReason: OnboardEnergymeterError"),

  // Outlet / power port
  key("OtherError", "StopReason: OutletError"),
  key("OtherError", "StopReason:OutletError"),
  key("OtherError", "StopReason: PowerPortFanFailure"),
  key("OtherError", "StopReason:PowerportFanFailure"),
  key("OtherError", "StopReason:PowerportInterlock"),
  key("OtherError", "StopReason:PowerportOverheat"),
  key("OtherError", "StopReason:PowerportOverheat modules disabled"),
  key("OtherError", "StopReason:PowerportPowerError"),
  key("OtherError", "StopReason:PowerportPowerError detected. X V"),
  key("OtherError", "StopReason:PowerportPowerError detected. req:X actual:Y"),
  key("OtherError", "StopReason:PowerportPowerError modules disabled"),
  key("OtherError", "StopReason: PowerPortErrorOther"),
  key("OtherError", "StopReason:PowerportErrorOther"),

  // Server unreachable
  key("OtherError", "StopReason: ServerUnreachable"),

  // Soft error — modules disabled / IMI
  key("OtherError", "StopReason:SoftError modules disabled"),
  key("OtherError", "StopReason:SoftError with IMI, cleared all other errors"),

  // Unlock
  key("OtherError", "StopReason: UnlockError"),

  // User requested stop — modules disabled
  key("OtherError", "StopReason:UserRequestedStop modules disabled"),

  // Vehicle errors
  key("OtherError", "StopReason:VehicleErrorVoltageApplied"),
  key("OtherError", "StopReason:VehicleLockError"),
  key("OtherError", "StopReason:VehicleNotConnected modules disabled"),

  // Vehicle protocol / stop — modules disabled
  key("OtherError", "StopReason:VehicleProtocolError modules disabled"),
  key("OtherError", "StopReason:VehicleStop modules disabled"),

  // (Leer)
  key("OtherError", "(Leer)"),
]);

function checkABB(ocpp: string, vendor: string): boolean {
  return ABB_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Alfen  (16 rows)
// ═════════════════════════════════════════════════════════════════════════════
const ALFEN_ESCALATE = new Set<string>([
  key("ConnectorLockFailure", "211"),
  key("ConnectorLockFailure", "404"),
  key("ConnectorLockFailure", "404 Unable to lock charging cable, try again"),
  key("GroundFailure", "105"),
  key("GroundFailure", "106"),
  key("GroundFailure", "201"),
  key("Offline", "(Leer)"),
  key("OtherError", "201 PE connection, check protective earth wiring"),
  key("PowerMeterFailure", "105"),
  key("PowerMeterFailure", "106"),
  key("PowerSwitchFailure", "102 Power switch error"),
]);

function checkAlfen(ocpp: string, vendor: string): boolean {
  return ALFEN_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Alpitronic  (30 rows)
// ═════════════════════════════════════════════════════════════════════════════
const ALPITRONIC_ESCALATE = new Set<string>([
  key("ConnectorLockFailure", "15 Lock Fault"),
  key("GroundFailure", "25"),
  key("GroundFailure", "25 Isolation Fault"),
  key("Offline", "(Leer)"),
  key("OtherError", "42"),
  key("OtherError", "63"),
  key("OtherError", "29 Isolation Warning"),
  key("OtherError", "42 Meter Error"),
  key("OtherError", "63 Cable Error"),
]);

function checkAlpitronic(ocpp: string, vendor: string): boolean {
  return ALPITRONIC_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Circontrol  (72 rows)
// ═════════════════════════════════════════════════════════════════════════════
const CIRCONTROL_ESCALATE = new Set<string>([
  key("Offline", "(Leer)"),
  key("OtherError", "CE.25.004"),
  key("OtherError", "CE.25.009"),
  key("OtherError", "CE.25.009 AC/DC converters error"),
  key("OtherError", "CE.25.010"),
  key("OtherError", "CO.01.001"),
  key("OtherError", "CO.01.003 Internal communications error"),
  key("OtherError", "CO.01.007"),
  key("GroundFailure", "CO.01.101"),
  key("OtherError", "CO.01.103"),
  key("OtherError", "CO.01.103 Internal communications error"),
  key("UnderVoltage", "CO.01.105"),
  key("OtherError", "CO.01.109"),
  key("OtherError", "CO.01.111"),
  key("OtherError", "CO.01.112"),
  key("OtherError", "CO.02.102"),
  key("OtherError", "CO.04.000"),
  key("PowerMeterFailure", "CO.14.003"),
  key("OtherError", "CO.23.003"),
  key("OtherError", "CO.24.001"),
  key("OtherError", "CO.24.002"),
  key("OtherError", "CO.24.003"),
  key("OtherError", "CO.24.003 Internal communications error"),
  key("OtherError", "CO.24.008 Hardware failure"),
  key("OtherError", "CO.25.000"),
  key("OtherError", "CO.25.000 AC/DC converters error"),
  key("OtherError", "CO.25.004"),
  key("OtherError", "CO.25.009"),
  key("OtherError", "CO.25.010"),
  key("PowerSwitchFailure", "CO.26.101"),
  key("PowerSwitchFailure", "CO.26.101 Welding contactor"),
  key("OtherError", "CO.27.001"),
  key("OtherError", "CO.27.001 Internal power supply failure"),
  key("OtherError", "CO.27.102"),
  key("GroundFailure", "CO.27.104"),
  key("GroundFailure", "CO.27.104 Current leak detected"),
  key("OverCurrentFailure", "CO.27.105"),
  key("OverCurrentFailure", "CO.27.105 Overcurrent protection triggered\xa0"),
  key("ConnectorLockFailure", "UE.22.101"),
  key("ConnectorLockFailure", "UE.22.101 Connector lock failure"),
  key("GroundFailure", "VE.27.101"),
]);

function checkCircontrol(ocpp: string, vendor: string): boolean {
  return CIRCONTROL_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// DBT  (14 rows)
// ═════════════════════════════════════════════════════════════════════════════
const DBT_ESCALATE = new Set<string>([
  key("OtherError", "0x0012"),
  key("OtherError", "0x0013"),
  key("OtherError", "0xf002"),
  key("OtherError", "0xf003"),
]);

function checkDBT(ocpp: string, vendor: string): boolean {
  return DBT_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Compleo  (38 rows)
// ═════════════════════════════════════════════════════════════════════════════
const COMPLEO_ESCALATE = new Set<string>([
  key("GroundFailure", "(Leer)"),
  key("HighTemperature", "(Leer)"),
  key("InternalError", "(Leer)"),
  key("Offline", "(Leer)"),
  key("OtherError", "AutomaticRcdResetContactorTestFailed"),
  key("OtherError", "AutomaticRcdResetSwitchOnFailed"),
  key("OtherError", "DcInsulationCodeFault"),
  key("OtherError", "DcInsulationTestFailureOnStart"),
  key("OtherError", "DcPsuConnectionFailure"),
  key("OtherError", "FuseError"),
  key("OtherError", "IsolationError"),
  key("OtherError", "IsolationWarning"),
  key("OtherError", "RCSensorTestRunning"),
  key("OtherError", "samEVSEIDMemoryFull"),
  key("OtherError", "samFirmwareCorrupted"),
  key("OtherError", "samInternalError"),
  key("OtherError", "samNotInitialized"),
  key("OtherError", "samNoTouchControllerComm"),
  key("OtherError", "samTransactionMemoryFull"),
  key("OtherError", "TemperatureSensorHighLimitViolation"),
  key("OtherError", "TemperatureSensorLowLimitViolation"),
  key("OtherError", "TemperatureSensorMissing"),
  key("PowerMeterFailure", "(Leer)"),
  key("PowerSwitchFailure", "(leer)"),
  key("ReaderFailure", "(leer)"),
]);

function checkCompleo(ocpp: string, vendor: string): boolean {
  return COMPLEO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// EV-Box  (14 rows)
// ═════════════════════════════════════════════════════════════════════════════
const EVBOX_ESCALATE = new Set<string>([
  key("ConnectorLockFailure", "\xa013A cable connected."),
  key("ConnectorLockFailure", "\xa0Lock not detected."),
  key("ConnectorLockFailure", "\xa0No car attached."),
  key("ConnectorLockFailure", "(Leer)"),
  key("Offline", "(Leer)"),
  key("OtherError", "Connectors with different software."),
  key("PowerMeterFailure", "\xa0AC loss."),
  key("PowerMeterFailure", "\xa0No meter value available."),
  key("PowerMeterFailure", "(Leer)"),
]);

function checkEVBox(ocpp: string, vendor: string): boolean {
  return EVBOX_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Schneider Electric  (50 rows)
// ═════════════════════════════════════════════════════════════════════════════
const SCHNEIDER_ESCALATE = new Set<string>([
  key("Offline", "(leer)"),
  key("READER_FAILURE", "1"),
  key("READER_FAILURE", "1 Rfid_Reader"),
  key("OtherError", "3"),
  key("OtherError", "3 Internal_Communication"),
  key("PowerSwitchFailure", "5"),
  key("PowerSwitchFailure", "5 Contactor_State"),
  key("GroundFailure", "11"),
  key("GroundFailure", "11 Upstream_Protection_Devices"),
  key("OtherError", "22"),
  key("OtherError", "22 Charge_Alarm_Ventilation_Not_Allowed"),
]);

function checkSchneider(ocpp: string, vendor: string): boolean {
  return SCHNEIDER_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Technagon  (29 rows)
// ═════════════════════════════════════════════════════════════════════════════
const TECHNAGON_ESCALATE = new Set<string>([
  key("EVCommunicationError", "\xa0Charging."),
  key("EVCommunicationError", "\xa0Plugged."),
  key("GroundFailure", "\xa0RCD tripped"),
  key("GroundFailure", "(Leer)"),
  key("Offline", "(Leer)"),
  key("OtherError", "(Leer)"),
  key("OtherError", "OverVoltageProtectionFailure"),
  key("OtherError", "EVSECommunicationError"),
  key("OtherError", "EVSECommunicationError Voltages: 0/0/0"),
  key("OverCurrentFailure", "\xa0MCB tripped"),
  key("OverCurrentFailure", "(Leer)"),
  key("PowerMeterFailure", "S/N Error"),
  key("PowerMeterFailure", "S/N Error Energy meter serial number not valid"),
  key("PowerSwitchFailure", "\xa0Plugged."),
  key("PowerSwitchFailure", "(Leer)"),
]);

function checkTechnagon(ocpp: string, vendor: string): boolean {
  return TECHNAGON_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Wirelane  (88 rows)
// Note: some OCPP codes use lowercase variants (e.g. "connectorLockFailure")
//       — stored exactly as they appear in the sheet.
// ═════════════════════════════════════════════════════════════════════════════
const WIRELANE_ESCALATE = new Set<string>([
  key("ConnectorLockFailure", "Actuator unlocked while charging"),
  key("ConnectorLockFailure", "Could not detect type 2 locking actuator"),
  key("EVCommunicationError", "(Leer)"),
  key("evCommunicationError", "15118 communication error"),
  key("GroundFailure", "\xa0RCD triggered"),
  key("GroundFailure", "Ground check (PE) failed"),
  key("GroundFailure", "RCMB error."),
  key("HighTemperature", "Cannot read critical temperature sensor"),
  key("HighTemperature", "Cannot read temperature sensor"),
  key("internalError", "15118 module failure"),
  key("internalError", "QCA7000 initialization failure"),
  key("Offline", "(Leer)"),
  key("OtherError", "\xa0Possible CP and PR wiring issue."),
  key("OtherError", "Failed init:"),
  key("OtherError", "OCPP meter failure"),
  key("OtherError", "Phase rotation failure."),
  key("OtherError", "Possible CP and PR wiring issue."),
  key("OtherError", "PR disconnected while car is connected."),
  key("OtherError", "RCMB ext oscillator error."),
  key("OtherError", "Slave is unavailable (disconnected from Master)."),
  key("OtherError", "The controller on the Chargepoint has a defect."),
  key("OtherError", "The current transformer has a defect."),
  key("OverCurrentFailure", "MCB of type 2 socket triggered"),
  key("OverCurrentFailure", "RCD-MCB triggered from unique input"),
  key("PowerMeterFailure", "(Leer)"),
  key("PowerMeterFailure", "No information received from ocpp meter"),
  key("PowerMeterFailure", "No information received from second meter"),
  key("PowerSwitchFailure", "Contactor welded"),
  key("ReaderFailure", "RFID reader not communicating"),
  key("UnderVoltage", "Contactor not closed"),
  key("UnderVoltage", "L1 voltage is missing"),
  key("WeakSignal", "eth interface had 0 link up-down sequences."),
]);

function checkWirelane(ocpp: string, vendor: string): boolean {
  return WIRELANE_ESCALATE.has(key(ocpp, vendor));
}


// // ─────────────────────────────────────────────────────────────────────────────
// // Smoke tests  (run with: npx ts-node checkEscalation.ts)
// // ─────────────────────────────────────────────────────────────────────────────
// if (require.main === module) {
//   const tests: Array<[string, string, string, boolean | null]> = [
//     // ABB
//     ["ABB", "Offline", "(Leer)", true],
//     ["ABB", "OtherError", "ChargeStopped:ChargerError", true],
//     ["ABB", "OtherError", "StopReason:LockError", true],
//     ["ABB", "OtherError", "DoorOpen", false],
//     ["ABB", "OtherError", "StopReason:SoftError", false],
//     ["ABB", "OtherError", "ConnectorPlacedInHolder", false],

//     // Alfen
//     ["Alfen", "ConnectorLockFailure", "404", true],
//     ["Alfen", "GroundFailure", "201", true],
//     ["Alfen", "Offline", "(Leer)", true],
//     ["Alfen", "PowerMeterFailure", "999", false],

//     // Alpitronic
//     ["Alpitronic", "OtherError", "42 Meter Error", true],
//     ["Alpitronic", "OtherError", "52 EV Communication Error", false],
//     ["Alpitronic", "EVCommunicationError", "3", false],

//     // Circontrol
//     ["Circontrol", "Offline", "(Leer)", true],
//     ["Circontrol", "OtherError", "CE.25.004", true],
//     ["Circontrol", "OtherError", "(Leer)", false],
//     ["Circontrol", "GroundFailure", "CO.27.104 Current leak detected", true],

//     // DBT
//     ["DBT", "OtherError", "0x0012", true],
//     ["DBT", "OtherError", "0xf003", true],
//     ["DBT", "OtherError", "0x0008", false],

//     // Compleo
//     ["Compleo", "Offline", "(Leer)", true],
//     ["Compleo", "OtherError", "IsolationError", true],
//     ["Compleo", "ConnectorLockFailure", "(Leer)", false],
//     ["Compleo", "OtherError", "DoorOpen", false],

//     // EV-Box
//     ["EV-Box", "Offline", "(Leer)", true],
//     ["EV-Box", "ConnectorLockFailure", "(Leer)", true],
//     ["EV-Box", "PowerMeterFailure", "(Leer)", true],
//     ["EV-Box", "OtherError", "UnknownCode", false],

//     // Schneider Electric
//     ["Schneider Electric", "Offline", "(leer)", true],
//     ["Schneider Electric", "READER_FAILURE", "1 Rfid_Reader", true],
//     ["Schneider Electric", "OtherError", "22", true],
//     ["Schneider Electric", "ConnectorLockFailure", "4", false],
//     ["Schneider Electric", "OtherError", "6 Surge_Arrestor", false],

//     // Technagon
//     ["Technagon", "Offline", "(Leer)", true],
//     ["Technagon", "OtherError", "(Leer)", true],
//     ["Technagon", "GroundFailure", "(Leer)", true],
//     ["Technagon", "ConnectorLockFailure", "(Leer)", false],
//     ["Technagon", "EVCommunicationError", "(Leer)", false],

//     // Wirelane
//     ["Wirelane", "Offline", "(Leer)", true],
//     ["Wirelane", "GroundFailure", "RCMB error.", true],
//     ["Wirelane", "OtherError", "Phase rotation failure.", true],
//     ["Wirelane", "OtherError", "System rebooting...", false],
//     ["Wirelane", "ResetFailure", "(Leer)", false],

//     // Unknown manufacturer
//     ["UnknownMfr", "OtherError", "(Leer)", null],
//   ];

//   let passed = 0;
//   for (const [hw, ocpp, vendor, expected] of tests) {
//     const result = shouldEscalate(hw, ocpp, vendor);
//     const ok = result === expected;
//     const icon = ok ? "✅" : "❌";
//     console.log(`${icon} [${hw}] shouldEscalate("${ocpp}", "${vendor}") → ${result} (expected ${expected})`);
//     if (ok) passed++;
//   }
//   console.log(`\n${passed}/${tests.length} tests passed`);
// }