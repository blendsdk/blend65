import {
  viceControlFailure,
  viceControlSuccess,
  type ViceControlHostV1,
  type ViceControlOwnedChildV1,
  type ViceControlRawChannelV1,
  type ViceControlResultV1,
} from "./vice-control-types.js";

/** Converts a thrown raw cleanup operation into a stable closed result. */
async function closeSafely(
  operation: () => Promise<ViceControlResultV1<true>>,
): Promise<ViceControlResultV1<true>> {
  try {
    return await operation();
  } catch {
    return viceControlFailure("vice.io", "vice.transport", "VICE cleanup failed.");
  }
}

/** Closes both channels and always attempts exact owned-child cleanup. */
export async function closeViceControlResourcesV1(
  binary: ViceControlRawChannelV1,
  text: ViceControlRawChannelV1,
  child: ViceControlOwnedChildV1,
  host: ViceControlHostV1,
): Promise<ViceControlResultV1<true>> {
  const [binaryResult, textResult] = await Promise.all([
    closeSafely(() => binary.close()),
    closeSafely(() => text.close()),
  ]);
  const childResult = await closeSafely(() => host.closeOwnedChild(child));
  return binaryResult.ok && textResult.ok && childResult.ok
    ? viceControlSuccess(true)
    : viceControlFailure("vice.io", "vice.transport", "VICE cleanup failed.");
}
