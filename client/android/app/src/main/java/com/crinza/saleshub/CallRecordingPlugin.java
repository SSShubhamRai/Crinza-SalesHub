package com.crinza.saleshub;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.os.Build;
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
    // CHECK PERMISSION
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

    // =========================================================
    // REQUEST PERMISSION
    // =========================================================

    @PluginMethod
    public void requestPermission(PluginCall call) {
        boolean granted =
                ContextCompat.checkSelfPermission(
                        getContext(),
                        Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED;

        // Already granted
        if (granted) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        // Ask Android for microphone permission
        requestPermissionForAlias(
                "audio",
                call,
                "permissionCallback"
        );
    }

    // =========================================================
    // PERMISSION CALLBACK
    // =========================================================

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
    // START RECORDING WORKFLOW (MediaRecorder Implementation)
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

            File outputDir = getContext().getCacheDir();
            File audioFile = File.createTempFile("call_" + callId + "_", ".m4a", outputDir);
            audioFilePath = audioFile.getAbsolutePath();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                mediaRecorder = new MediaRecorder(getContext());
            } else {
                mediaRecorder = new MediaRecorder();
            }

            // VOICE_COMMUNICATION source tries to capture call audio stream where supported
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setOutputFile(audioFilePath);

            mediaRecorder.prepare();
            mediaRecorder.start();

            Log.d(TAG, "🎙️ MediaRecorder started successfully: " + audioFilePath);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("callId", callId);
            result.put("filePath", audioFilePath);
            result.put("message", "Recording workflow started.");

            call.resolve(result);

        } catch (IOException e) {
            Log.e(TAG, "🔥 MediaRecorder prepare/start failed", e);
            releaseRecorder();
            call.reject("Failed to start recording: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "🔥 Unexpected error starting recorder", e);
            releaseRecorder();
            call.reject("Unexpected error: " + e.getMessage());
        }
    }

    // =========================================================
    // STOP RECORDING WORKFLOW
    // =========================================================

    @PluginMethod
    public void stopRecording(PluginCall call) {
        String callId = call.getString("callId");

        try {
            if (mediaRecorder != null) {
                mediaRecorder.stop();
                mediaRecorder.release();
                mediaRecorder = null;
                Log.d(TAG, "🛑 MediaRecorder stopped successfully.");
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("callId", callId);
            result.put("filePath", audioFilePath);
            result.put("message", "Recording workflow stopped.");

            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "🔥 Failed to stop MediaRecorder", e);
            releaseRecorder();
            call.reject("Failed to stop recording: " + e.getMessage());
        }
    }

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