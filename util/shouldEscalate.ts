/**
 * OCPP / Vendor Error escalation checker — Hardware Manufacturer aware.
 * Source: CheckEscalation.xlsx (10 manufacturer sheets)
 *
 * Logic: INVERTED from previous version.
 *   Each manufacturer has a NO_ESCALATE denylist of known-safe combos.
 *   Anything NOT in the denylist → escalate (true).
 *   Unknown manufacturer → escalate to be safe (true).
 *
 * @param hardware    - Hardware manufacturer name (case-insensitive)
 * @param ocppError   - OCPP error code string
 * @param vendorError - Vendor-specific error string or number (pass as string)
 * @returns true  → escalate to support
 *          false → no escalation needed
 */
export function shouldEscalate(
  hardware: string,
  ocppError: string,
  vendorError: string
): boolean {
  switch (hardware.trim().toLowerCase()) {
    case "abb":
      return checkABB(ocppError, vendorError);
    case "alfen":
    case "alfen b.v.":
      return checkAlfen(ocppError, vendorError);
    case "alpitronic":
      return checkAlpitronic(ocppError, vendorError);
    case "circontrol":
    case "circontrol s.a.":
      return checkCircontrol(ocppError, vendorError);
    case "dbt":
    case "dbt-cev":
      return checkDBT(ocppError, vendorError);
    case "compleo":
      return checkCompleo(ocppError, vendorError);
    case "ev-box":
    case "evbox":
      return checkEVBox(ocppError, vendorError);
    case "schneider electric":
    case "schneider electric se":
    case "schneider":
      return checkSchneider(ocppError, vendorError);
    case "technagon":
      return checkTechnagon(ocppError, vendorError);
    case "wirelane":
      return checkWirelane(ocppError, vendorError);
    case "ekoenergetyka polska s.a":
    case "ekoenergetyka polska s.a.":
      return checkEkoenergetyka(ocppError, vendorError);
    default:
      return true; // unknown manufacturer → escalate to be safe
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — compound key for Set lookups
// ─────────────────────────────────────────────────────────────────────────────
function key(ocpp: string, vendor: string): string {
  return `${ocpp}|${vendor}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// ABB — denylist (escalation = no)
// ═════════════════════════════════════════════════════════════════════════════
const ABB_NO_ESCALATE = new Set<string>([
  key("OtherError", "ChargeNotStarted:CableError"),
  key("OtherError", "ChargeNotStarted:LockError"),
  key("OtherError", "ChargeNotStarted:VehicleNotConnected"),
  key("OtherError", "ChargeNotStarted:VehicleShiftPosition"),
  key("OtherError", "ChargeStopped:CableRemoved"),
  key("OtherError", "ChargeStopped:VehicleProtocolError"),
  key("OtherError", "DoorClosed"),
  key("OtherError", "DoorOpen"),
  key("OtherError", "EmergencyButtonPressed"),
  key("OtherError", "EmergencyButtonReleased"),
  key("OtherError", "StopReason: AuthorizedStop"),
  key("OtherError", "StopReason: BatteryFull"),
  key("OtherError", "StopReason:BudgetExceeded"),
  key("OtherError", "StopReason: ChargerCableCoolerTemperature"),
  key("OtherError", "StopReason: ChargerCableTemperature"),
  key("OtherError", "StopReason: ChargerContactorTemperature"),
  key("OtherError", "StopReason:ChargerLoweringCurrentTimeout"),
  key("OtherError", "StopReason:ChargerMaxVoltage"),
  key("OtherError", "StopReason:ChargerPrechargeTimeout"),
  key("OtherError", "StopReason: ChargerStopTimout"),
  key("OtherError", "StopReason:ChargerTemperatureError"),
  key("OtherError", "StopReason: ChargerTimeCompleted"),
  key("OtherError", "StopReason: ConnectorButtonPressed"),
  key("OtherError", "StopReason: EmergencyStop"),
  key("OtherError", "StopReason:IncompatibleVehicle"),
  key("OtherError", "StopReason:Invalid"),
  key("OtherError", "StopReason: InvalidOnCharger"),
  key("OtherError", "StopReason:IsolationTestFailed"),
  key("OtherError", "StopReason:NoError"),
  key("OtherError", "StopReason: NoMatchingIDs"),
  key("OtherError", "StopReason: NormalStop"),
  key("OtherError", "StopReason: PowerPortVipError"),
  key("OtherError", "StopReason: RequestRejected"),
  key("OtherError", "StopReason:SoftError"),
  key("OtherError", "StopReason: StoppedByVehicle"),
  key("OtherError", "StopReason:UserRequestedStop"),
  key("OtherError", "StopReason: VehicleBatteryMalfunction"),
  key("OtherError", "StopReason: VehicleBatteryTemperatureOutOfRange"),
  key("OtherError", "StopReason:VehicleCurrentDifference"),
  key("OtherError", "StopReason:VehicleError"),
  key("OtherError", "StopReason:VehicleErrorReversePolarity"),
  key("OtherError", "StopReason:VehicleErrorVoltageApplied modules disabled"),
  key("OtherError", "StopReason:VehicleNotConnected"),
  key("OtherError", "StopReason:VehicleProtocolError"),
  key("OtherError", "StopReason:VehicleProtocolError EST_CORRECT"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_AuthSt_C_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B1_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_AuthSt_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_AuthSt_ProtTimeoutErr_EVstopAbnrml_"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_AuthSt_VehConClsd_EVstopAbnrml_NIR_"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_NIR_0x4b_AuthSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_NIR_0x4b_AuthSt_ProtTimeoutErr_EVst"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_NIR_0x4b_AuthSt_VehConClsd"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_NIR_0x4b_AuthSt_VehConClsd_EVstopAb"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_NIR_0x4b_PaymSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_NIR_0x4b_PEVMAC_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_NIR_0x4b_SlacMatchSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_NIR_0x4b_SupAppPrSt_VehConClsd_EVst"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_VehConClsd_PEVMAC"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_B2_VehConClsd_PEVMAC_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_AuthSt_A_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_AuthSt_B1_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_AuthSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_AuthSt_C_VehConClsd_EVstopAbn"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_B2_AuthSt_VehConClsd_EVstopAb"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_B2_SesStopSt_SesIdInvErr_EVst"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_B2_SlacMatchSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_B2_SupAppPrSt_VehConClsd_EVst"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_ChrgDiscSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_CurDemSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_PchargeSt_B2_PchargeErr_EVsto"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_NIR_0x4b_SlacMatchSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_SlacMatchSt_B2_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_AuthSt_B1_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_AuthSt_B2_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_AuthSt_C_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_AuthSt_C_VehConClsd_EVstopAbnrml_NIR_0x4"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B1_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B1_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B1_NIR_0x4b_PEVMAC_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B1_NIR_0x4b_SlacMatchSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B1_NIR_0x4b_SupAppPrSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B1_PEVMAC_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B1_SlacMatchSt_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_AuthSt_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_AuthSt_EVstopAbnrml_VehConClsd_NIR_0x"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_AuthSt_ProtTimeoutErr_NIR_0x4b_EVstop"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_AuthSt_ProtTimeoutErr_NIR_0x4b_VehCon"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_AuthSt_VehConClsd_EVstopAbnrml_NIR_0x"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_ChrgDiscSt_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_AuthSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_AuthSt_EVstopAbnrml_ProtTime"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_AuthSt_ProtTimeoutErr_EVstop"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_AuthSt_VehConClsd"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_AuthSt_VehConClsd_EVstopAbnr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_ChrgDiscSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_ChrgDiscSt_VehConClsd_EVstop"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_PEVMAC_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_SdpRspSt_EVstopAbnrml_VehCon"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_SdpRspSt_VehConClsd"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_SdpRspSt_VehConClsd_EVstopAb"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_SesStopSt_SesIdInvErr_EVstop"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_NIR_0x4b_SlacMatchSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_PEVMAC_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_PEVMAC_NIR_0x4b_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_SdpRspSt_EVstopAbnrml_NIR_0x4b_VehCon"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_SdpRspSt_InvProtErr_NIR_0x4b_EVstopAb"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_SesStopSt_SesIdInvErr_EVstopAbnrml_NI"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_SlacMatchSt_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_SupAppPrSt_VehConClsd_EVstopAbnrml_NI"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_VehConClsd_NIR_0x4b_SlacMatchSt"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_B2_VehConClsd_NIR_0x4b_SlacMatchSt_EVsto"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_CblChkSt_CblChkErr_EVstopAbnrml_NIR_0x"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_CblChkSt_CblChkErr_NIR_0x4b_EVstopAbnr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_CblChkSt_CblChkErr_VehConClsd_EVstopAb"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_CblChkSt_CblChkErr_VehConClsd_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_CurDemSt_CurrDvlrErr_EVstopAbnrml_NIR_"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_CurDemSt_CurrDvlrErr_NIR_0x4b_EVstopAb"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_CurDemSt_VehConClsd_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_PchargeSt_PchargeErr_NIR_0x4b_VehConCl"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_PchargeSt_PchargeErr_VehConClsd_EVstop"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_C_PchargeSt_VehConClsd_PchargeErr_EVstop"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_ChrgDiscSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_ChrgDiscSt_B2_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_CurDemSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_CurDemSt_B2_EVstopAbnrml_NIR_0x4b"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_EVstopAbnrml_B2_SdpRspSt_InvProtErr_NIR_"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_AuthSt_A_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_AuthSt_B1_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_AuthSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_AuthSt_C_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_AuthSt_C_VehConClsd_EVstopAbnrm"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_AuthSt_VehConClsd_B1_EVstopAbnr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_B1_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_B2_AuthSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_B2_AuthSt_VehConClsd_EVstopAbnr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_B2_ChrgDiscSt_VehConClsd"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_B2_ChrgDiscSt_VehConClsd_EVstop"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_B2_SdpRspSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_B2_SesStopSt_SesIdInvErr_EVstop"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_B2_SlacMatchSt_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_C_CblChkSt_CblChkErr_EVstopAbnr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_C_CurDemSt_CurrDvlrErr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_C_CurDemSt_CurrDvlrErr_EVstopAb"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_C_CurDemSt_VehConClsd_EVstopAbn"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_C_PchargeSt_VehConClsd_EVstopAb"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_C_PchargeSt_VehConClsd_PchargeE"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_C_SesStopSt_V2gProtSeqErr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_C_SesStopSt_V2gProtSeqErr_EVsto"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_CblChkSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_CblChkSt_EVstopAbnrml_B1_CblChk"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_ChrgDiscSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_ChrgDiscSt_C_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_CurDemSt_B1_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_CurDemSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_PchargeSt_B2_EVstopAbnrml_Pchar"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_PchargeSt_B2_PchargeErr_EVstopA"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_PEVMAC_B1_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_PEVMAC_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_SesStopSt_EVstopCplt_VehConClsd"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_SesStopSt_VehConClsd_B2_CblChkE"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_NIR_0x4b_SlacMatchSt_B1_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_PEVMAC_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_ProxLost_C_PchargeSt_VehConClsd_PchargeE"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_ProxLost_NIR_0x4b_C_PchargeSt_VehConClsd"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_VehConClsd_B2_AuthSt_EVstopAbnrml_NIR_0x"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_VehConClsd_B2_NIR_0x4b_AuthSt_EVstopAbnr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_VehConClsd_NIR_0x4b_AuthSt_A_EVstopAbnrm"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_VehConClsd_NIR_0x4b_AuthSt_B2_EVstopAbnr"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_VehConClsd_NIR_0x4b_B2_SesStopSt_SesIdIn"),
  key("OtherError", "StopReason:VehicleProtocolError EST_UNDEF_NOSTART"),
  key("OtherError", "StopReason: VehicleShiftPosition"),
  key("OtherError", "StopReason:VehicleStop"),
  key("OtherError", "StopReason:VehicleStop EST_UNDEF_NOSTART"),
  key("OtherError", "StopReason:VehicleVoltageOutOfRange"),
  key("OtherError", "StopReason: VehicleWeldingDetectionTimeout"),
  key("OtherError", "StopReason: WrongMessage"),
  key("OtherError", "ConnectorPlacedInHolder"),
  key("OtherError", "ConnectorRemovedFromHolder"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_C_EVDerateInfo_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_CurDemSt_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_NOSTART_EVDerateInfo_B2_EVstopAbnrml"),
  key("OtherError", "StopReason:VehicleProtocolError EST_START_EVDerateInfo_B2_EVstopAbnrml"),
]);

function checkABB(ocpp: string, vendor: string): boolean {
  return !ABB_NO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Alfen — all rows are "yes" in Excel, so denylist is empty → always escalate
// ═════════════════════════════════════════════════════════════════════════════
function checkAlfen(_ocpp: string, _vendor: string): boolean {
  return true; // every known Alfen error escalates
}

// ═════════════════════════════════════════════════════════════════════════════
// Alpitronic — denylist (escalation = no)
// ═════════════════════════════════════════════════════════════════════════════
const ALPITRONIC_NO_ESCALATE = new Set<string>([
  key("EVCommunicationError", "3"),
  key("EVCommunicationError", "13"),
  key("EVCommunicationError", "13 TCP Error"),
  key("EVCommunicationError", "14 V2G Error"),
  key("EVCommunicationError", "2 SLAC Error"),
  key("EVCommunicationError", "3 SLAC Error"),
  key("EVCommunicationError", "4 Link Error"),
  key("EVCommunicationError", "5 Link Error"),
  key("OtherError", "52"),
  key("OtherError", "53"),
  key("OtherError", "50 EV Error"),
  key("OtherError", "52 EV Communication Error"),
  key("OtherError", "53 EV Communication Error"),
  key("OtherError", "70 EV Communication Error"),
  key("OtherError", "75 EV Communication Error"),
  key("OtherError", "78 EV Communication Error"),
]);

function checkAlpitronic(ocpp: string, vendor: string): boolean {
  return !ALPITRONIC_NO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Circontrol — denylist (escalation = no)
// ═════════════════════════════════════════════════════════════════════════════
const CIRCONTROL_NO_ESCALATE = new Set<string>([
  key("OtherError", "(Leer)"),
  key("ResetFailure", "(Leer)"),
  key("OtherError", "CE.27.103"),
  key("OtherError", "CE.27.103 Isolation error"),
  key("OtherError", "CO.00.000"),
  key("OtherError", "CO.00.000 Generic error"),
  key("OtherError", "CO.01.002"),
  key("OtherError", "CO.01.003"),
  key("OtherError", "CO.01.102"),
  key("OverVoltage", "CO.01.104"),
  key("HighTemperature", "CO.01.108"),
  key("ReaderFailure", "CO.11.000"),
  key("OtherError", "CO.27.003"),
  key("OtherError", "CO.27.003 Internal communications error"),
  key("OtherError", "CO.30.001"),
  key("WeakSignal", "CW.01.110"),
  key("EVCommunicationError", "UE.20.101"),
  key("EVCommunicationError", "UE.20.101 Vehicle not detected"),
  key("OtherError", "UO.02.101"),
  key("OtherError", "UO.02.101 Door tamper alarm"),
  key("OtherError", "UO.03.101"),
  key("OtherError", "UO.03.101 Emergency button pressed"),
  key("OtherError", "VE.20.000"),
  key("EVCommunicationError", "VE.20.003"),
  key("OverCurrentFailure", "VE.20.102"),
  key("OtherError", "VE.21.101"),
]);

function checkCircontrol(ocpp: string, vendor: string): boolean {
  return !CIRCONTROL_NO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// DBT — denylist (escalation = no)
// ═════════════════════════════════════════════════════════════════════════════
const DBT_NO_ESCALATE = new Set<string>([
  key("OtherError", "0x0008"),
  key("OtherError", "0x0016"),
  key("OtherError", "0x0020"),
  key("OtherError", "0x0021"),
  key("OtherError", "0xff03"),
]);

function checkDBT(ocpp: string, vendor: string): boolean {
  return !DBT_NO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Compleo — denylist (escalation = no)
// ═════════════════════════════════════════════════════════════════════════════
const COMPLEO_NO_ESCALATE = new Set<string>([
  key("ConnectorLockFailure", "(Leer)"),
  key("OtherError", "AutomaticRcdTestRunning"),
  key("OtherError", "DcInsulationCodeInvalid"),
  key("OtherError", "DcInsulationCodeWarning"),
  key("OtherError", "DcInsulationTestFailureOnCharge"),
  key("OtherError", "DoorClosed"),
  key("OtherError", "DoorOpen"),
  key("OtherError", "Inoperative"),
]);

function checkCompleo(ocpp: string, vendor: string): boolean {
  return !COMPLEO_NO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// EV-Box — all rows are "yes" in Excel → always escalate
// ═════════════════════════════════════════════════════════════════════════════
function checkEVBox(_ocpp: string, _vendor: string): boolean {
  return true; // every known EV-Box error escalates
}

// ═════════════════════════════════════════════════════════════════════════════
// Schneider Electric — denylist (escalation = no)
// ═════════════════════════════════════════════════════════════════════════════
const SCHNEIDER_NO_ESCALATE = new Set<string>([
  key("ConnectorLockFailure", "4"),
  key("ConnectorLockFailure", "4 Outlet_Lock"),
  key("OtherError", "6"),
  key("OtherError", "6 Surge_Arrestor"),
  key("OtherError", "7"),
  key("OtherError", "7 Anti-intrusion"),
  key("OtherError", "8"),
  key("OtherError", "8 Hardware_Configuration"),
  key("OtherError", "9"),
  key("OtherError", "9 Software_Configuration"),
  key("OtherError", "10"),
  key("OtherError", "10 Flap_Sensor"),
  key("PowerMeterFailure", "12"),
  key("PowerMeterFailure", "12 Power_Meter_Communication"),
  key("OtherError", "14"),
  key("OtherError", "14 [Un]Plug_Process"),
  key("OtherError", "15"),
  key("OtherError", "15 Load tri-phasis compliancy"),
  key("OtherError", "16"),
  key("OtherError", "16 Plc Connection"),
  key("OtherError", "17"),
  key("OtherError", "17 Control_Pilot (CP) Signal conformity"),
  key("OtherError", "18"),
  key("OtherError", "18 Plug_Presence (PP) conformity"),
  key("OtherError", "19"),
  key("OtherError", "19 Charge_Alarm_EV_Disconnected"),
  key("OtherError", "20"),
  key("OtherError", "20 Charge_Alarm_ShortCut"),
  key("OverCurrentFailure", "21"),
  key("OverCurrentFailure", "21 Charge_Alarm_Overload"),
  key("WeakSignal", "24"),
  key("WeakSignal", "24 Modem_Communication"),
  key("OtherError", "25"),
  key("OtherError", "25 Energy Reserve"),
]);

function checkSchneider(ocpp: string, vendor: string): boolean {
  return !SCHNEIDER_NO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Technagon — denylist (escalation = no)
// ═════════════════════════════════════════════════════════════════════════════
const TECHNAGON_NO_ESCALATE = new Set<string>([
  key("ConnectorLockFailure", " Connector lock failure (unlocked)"),
  key("ConnectorLockFailure", " Connector lock failure (locked)"),
  key("ConnectorLockFailure", "(Leer)"),
  key("EVCommunicationError", " Voltages: X/Y/Z"),
  key("EVCommunicationError", "(Leer)"),
  key("UnderVoltage", " Voltages: X/Y/Z"),
  key("WeakSignal", "(Leer)"),
  key("ReaderFailure", "(Leer)"),
  key("HighTemperature", "(Leer)"),
]);

function checkTechnagon(ocpp: string, vendor: string): boolean {
  return !TECHNAGON_NO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Wirelane — denylist (escalation = no)
// ═════════════════════════════════════════════════════════════════════════════
const WIRELANE_NO_ESCALATE = new Set<string>([
  key("ConnectorLockFailure", "(Leer)"),
  key("connectorLockFailure", "Actuator emergency opener faulted"),
  key("ConnectorLockFailure", "Locking without plug error"),
  key("ConnectorLockFailure", "temperature sensor"),
  key("ConnectorLockFailure", "Type 2 locking actuator stuck cannot unlock"),
  key("EVCommunicationError", "Vehicle signals error"),
  key("GroundFailure", " Residual current detected via sensor"),
  key("GroundFailure", "(Leer)"),
  key("HighTemperature", " Housing temperature too high - charging paused"),
  key("HighTemperature", " Temperature too high - charging paused"),
  key("HighTemperature", "(Leer)"),
  key("HighTemperature", "High temperature alert."),
  key("mode3Error", "Vehicle diode check failed - tamper detection"),
  key("mode3Error", "Vehicle signals error"),
  key("OtherError", " Temperature approaching limit - current reduced"),
  key("OtherError", "(Leer)"),
  key("OtherError", "15118 authentication failed"),
  key("OtherError", "15118 authorization failed"),
  key("OtherError", "15118 certificate installation failed"),
  key("OtherError", "Car current is 10% more than expected."),
  key("OtherError", "Car current overload, charging stopped."),
  key("OtherError", "CP above 7.5V detected with STATE C/D."),
  key("OtherError", "Delaying FW update until transaction is stopped"),
  key("OtherError", "Diagnostics failed."),
  key("OtherError", "DLM Slave disconnected and not charging"),
  key("OtherError", "Firmware update failed."),
  key("OtherError", "Firmware update rolled back."),
  key("OtherError", "FW Update in progress"),
  key("OtherError", "FW update package manager fault"),
  key("OtherError", "Housing temperature approaching limit - charg(...)"),
  key("OtherError", "Internal communication error"),
  key("OtherError", "Low frequency detected, charging is paused"),
  key("OtherError", "Master and Slave have different SW version."),
  key("OtherError", "Message queue is full"),
  key("OtherError", "Not all DLM Slaves connected"),
  key("OtherError", "Relay temperature too high - charging current reduced"),
  key("OtherError", "State D detected, charging is paused"),
  key("OtherError", "System rebooting..."),
  key("OtherError", "Temperature reaches safety limit - emergency stop"),
  key("OtherError", "The charge point is tilted."),
  key("OtherError", "The charge point was tilted"),
  key("OverCurrentFailure", "MCB of domestic socket triggered"),
  key("OverVoltage", "High voltage detected, charging is paused"),
  key("ResetFailure", " Terminated transaction after reset! Power Outage?"),
  key("ResetFailure", "(Leer)"),
  key("ResetFailure", "Terminated transaction after reset! Power Outage?"),
  key("ResetFailure", "Unintended Reset - Power Outage?"),
  key("UnderVoltage", "Low voltage detected, charging is paused"),
  key("UnderVoltage", "There is no power on mains."),
  key("WeakSignal", "(Leer)"),
]);

function checkWirelane(ocpp: string, vendor: string): boolean {
  return !WIRELANE_NO_ESCALATE.has(key(ocpp, vendor));
}

// ═════════════════════════════════════════════════════════════════════════════
// Ekoenergetyka Polska — not in Excel; escalate everything by default,
// denylist can be populated as non-escalating combos are identified
// ═════════════════════════════════════════════════════════════════════════════
function checkEkoenergetyka(_ocpp: string, _vendor: string): boolean {
  return true; // escalate all until denylist is known
}