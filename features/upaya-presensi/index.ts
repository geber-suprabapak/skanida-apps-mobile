import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";

import {
  precheckAttendance,
  submitAttendance,
  type BffAttendanceAction,
} from "~/utils/bffMobileApi";

import {
  createUpayaPresensi,
  type PendingAttendanceSuccess,
  type UpayaPresensiWorkflow,
} from "./upayaPresensi";

export * from "./upayaPresensi";

const normalizeFileUri = (path: string) =>
  path.startsWith("file://") ? path : `file://${path}`;

const workflow: UpayaPresensiWorkflow = createUpayaPresensi({
  location: {
    async getCurrentPosition() {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== "granted") {
        return { permissionGranted: false, mocked: false };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        permissionGranted: true,
        mocked: Boolean(location.mocked),
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      };
    },
  },
  capture: {
    async readBase64(snapshotPath) {
      const uri = normalizeFileUri(snapshotPath);
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error("Capture file does not exist");
      return FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    },
    async cleanup(snapshotPath) {
      await FileSystem.deleteAsync(normalizeFileUri(snapshotPath), {
        idempotent: true,
      });
    },
  },
  gateway: {
    precheck: precheckAttendance,
    async submit({ actionType, imageBase64, coordinates }) {
      const result = await submitAttendance({
        action_type: actionType as BffAttendanceAction,
        image_base64: imageBase64,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      return {
        attendanceType: result.attendance_type,
        processingTime: result.processed_ms,
      };
    },
  },
});

export const prepareUpayaPresensi = workflow.prepare;
export const completeUpayaPresensi = workflow.complete;
export const cancelUpayaPresensi = workflow.cancel;
export const consumePendingAttendanceSuccess = workflow.consumeSuccessHandoff;
export type { PendingAttendanceSuccess };
