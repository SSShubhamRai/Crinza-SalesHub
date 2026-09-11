package com.crinza.saleshub;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaRecorder;
import android.os.Build;
import android.provider.CallLog;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.IOException;

@CapacitorPlugin(
    name = "CallRecording",
    permissions = {
        @Permission(
            alias = "audio",
            strings = {
                Manifest.permission.RECORD_AUDIO
            }
        ),
        @Permission(
            alias = "callLog",
            strings = {
                Manifest.permission.READ_CALL_LOG
            }
        )
    }
)
public class CallRecordingPlugin extends Plugin {

    private static CallRecordingPlugin instance;

    private MediaRecorder mediaRecorder;
    private String audioFilePath = "";

    private static final String TAG = "CallRecordingPlugin";

    // =========================================================
    // INITIALIZE
    // =========================================================

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    // =========================================================
    // SEND CALL STATE TO REACT
    // =========================================================

    public static void notifyCallState(String state) {
        if (instance == null) {
            return;
        }

        JSObject data = new JSObject();
        data.put("state", state);

        instance.notifyListeners(
            "callStateChanged",
            data
        );
    }

    // =========================================================
    // SEND CALL STATE WITH DURATION TO REACT
    // =========================================================

    public static void notifyCallStateWithDuration(
        String state,
        long durationSeconds
    ) {
        if (instance == null) {
            return;
        }

        JSObject data = new JSObject();
        data.put("state", state);
        data.put("durationSeconds", durationSeconds);

        instance.notifyListeners(
            "callStateChanged",
            data
        );
    }

    // =========================================================
    // EXISTING AUDIO PERMISSION
    // =========================================================

    @PluginMethod
    public void checkPermission(PluginCall call) {

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", granted);

        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED;

        if (granted) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        requestPermissionForAlias(
            "audio",
            call,
            "permissionCallback"
        );
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", granted);

        call.resolve(result);
    }

    // =========================================================
    // CALL LOG PERMISSION
    // =========================================================

    @PluginMethod
    public void checkCallLogPermission(PluginCall call) {

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", granted);

        call.resolve(result);
    }

    // =========================================================
    // REQUEST CALL LOG PERMISSION
    // =========================================================

    @PluginMethod
    public void requestCallLogPermission(PluginCall call) {

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED;

        if (granted) {

            JSObject result = new JSObject();
            result.put("granted", true);

            call.resolve(result);
            return;
        }

        requestPermissionForAlias(
            "callLog",
            call,
            "callLogPermissionCallback"
        );
    }

    // =========================================================
    // CALL LOG PERMISSION CALLBACK
    // =========================================================

    @PermissionCallback
    private void callLogPermissionCallback(PluginCall call) {

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", granted);

        call.resolve(result);
    }

    // =========================================================
    // GET DEVICE CALL LOG
    // =========================================================

    @PluginMethod
    public void getCallLogs(PluginCall call) {

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED;

        if (!granted) {
            call.reject(
                "READ_CALL_LOG permission is not granted."
            );
            return;
        }

        Cursor cursor = null;

        try {

            JSObject result = new JSObject();

            com.getcapacitor.JSArray calls =
                new com.getcapacitor.JSArray();

            String[] projection = {
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION
            };

            cursor = getContext()
                .getContentResolver()
                .query(
                    CallLog.Calls.CONTENT_URI,
                    projection,
                    null,
                    null,
                    CallLog.Calls.DATE + " DESC"
                );

            if (cursor != null) {

                int idIndex =
                    cursor.getColumnIndex(
                        CallLog.Calls._ID
                    );

                int numberIndex =
                    cursor.getColumnIndex(
                        CallLog.Calls.NUMBER
                    );

                int typeIndex =
                    cursor.getColumnIndex(
                        CallLog.Calls.TYPE
                    );

                int dateIndex =
                    cursor.getColumnIndex(
                        CallLog.Calls.DATE
                    );

                int durationIndex =
                    cursor.getColumnIndex(
                        CallLog.Calls.DURATION
                    );

                while (cursor.moveToNext()) {

                    JSObject item = new JSObject();

                    long id =
                        cursor.getLong(idIndex);

                    String number =
                        cursor.getString(numberIndex);

                    int type =
                        cursor.getInt(typeIndex);

                    long timestamp =
                        cursor.getLong(dateIndex);

                    long duration =
                        cursor.getLong(durationIndex);

                    item.put(
                        "deviceCallLogId",
                        String.valueOf(id)
                    );

                    item.put(
                        "phoneNumber",
                        number == null ? "" : number
                    );

                    item.put(
                        "type",
                        mapCallType(type)
                    );

                    item.put(
                        "timestamp",
                        timestamp
                    );

                    item.put(
                        "durationSeconds",
                        duration
                    );

                    item.put(
                        "connected",
                        duration > 0
                    );

                    calls.put(item);
                }
            }

            result.put(
                "calls",
                calls
            );

            result.put(
                "count",
                calls.length()
            );

            call.resolve(result);

        } catch (Exception e) {

            Log.e(
                TAG,
                "Failed to read call log",
                e
            );

            call.reject(
                "Failed to read call log: "
                + e.getMessage()
            );

        } finally {

            if (cursor != null) {
                cursor.close();
            }
        }
    }

    // =========================================================
    // MAP ANDROID CALL TYPE
    // =========================================================

    private String mapCallType(int type) {

        switch (type) {

            case CallLog.Calls.INCOMING_TYPE:
                return "INCOMING";

            case CallLog.Calls.OUTGOING_TYPE:
                return "OUTGOING";

            case CallLog.Calls.MISSED_TYPE:
                return "MISSED";

            case CallLog.Calls.REJECTED_TYPE:
                return "REJECTED";

            case CallLog.Calls.BLOCKED_TYPE:
                return "BLOCKED";

            default:
                return "UNKNOWN";
        }
    }

    // =========================================================
    // START RECORDING
    // =========================================================

    @PluginMethod
    public void startRecording(PluginCall call) {

        String callId = call.getString("callId");

        if (callId == null || callId.trim().isEmpty()) {
            call.reject("callId is required.");
            return;
        }

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED;

        if (!granted) {
            call.reject(
                "RECORD_AUDIO permission is not granted."
            );
            return;
        }

        try {

            releaseRecorder();

            File outputDir =
                getContext().getCacheDir();

            File audioFile =
                File.createTempFile(
                    "call_" + callId + "_",
                    ".m4a",
                    outputDir
                );

            audioFilePath =
                audioFile.getAbsolutePath();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                mediaRecorder =
                    new MediaRecorder(getContext());
            } else {
                mediaRecorder =
                    new MediaRecorder();
            }

            mediaRecorder.setAudioSource(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION
            );

            mediaRecorder.setOutputFormat(
                MediaRecorder.OutputFormat.MPEG_4
            );

            mediaRecorder.setAudioEncoder(
                MediaRecorder.AudioEncoder.AAC
            );

            mediaRecorder.setOutputFile(
                audioFilePath
            );

            mediaRecorder.prepare();
            mediaRecorder.start();

            Log.d(
                TAG,
                "MediaRecorder started: "
                + audioFilePath
            );

            JSObject result = new JSObject();

            result.put("success", true);
            result.put("callId", callId);
            result.put("filePath", audioFilePath);
            result.put(
                "message",
                "Recording workflow started."
            );

            call.resolve(result);

        } catch (IOException e) {

            Log.e(
                TAG,
                "MediaRecorder failed",
                e
            );

            releaseRecorder();

            call.reject(
                "Failed to start recording: "
                + e.getMessage()
            );

        } catch (Exception e) {

            Log.e(
                TAG,
                "Unexpected recording error",
                e
            );

            releaseRecorder();

            call.reject(
                "Unexpected error: "
                + e.getMessage()
            );
        }
    }

    // =========================================================
    // STOP RECORDING
    // =========================================================

    @PluginMethod
    public void stopRecording(PluginCall call) {

        String callId =
            call.getString("callId");

        try {

            if (mediaRecorder != null) {

                mediaRecorder.stop();
                mediaRecorder.release();
                mediaRecorder = null;

                Log.d(
                    TAG,
                    "MediaRecorder stopped."
                );
            }

            JSObject result =
                new JSObject();

            result.put(
                "success",
                true
            );

            result.put(
                "callId",
                callId
            );

            result.put(
                "filePath",
                audioFilePath
            );

            result.put(
                "message",
                "Recording workflow stopped."
            );

            call.resolve(result);

        } catch (Exception e) {

            Log.e(
                TAG,
                "Failed to stop MediaRecorder",
                e
            );

            releaseRecorder();

            call.reject(
                "Failed to stop recording: "
                + e.getMessage()
            );
        }
    }

    // =========================================================
    // RELEASE RECORDER
    // =========================================================

    private void releaseRecorder() {

        if (mediaRecorder != null) {

            try {
                mediaRecorder.stop();
            } catch (Exception ignored) {}

            try {
                mediaRecorder.release();
            } catch (Exception ignored) {}

            mediaRecorder = null;
        }
    }
}