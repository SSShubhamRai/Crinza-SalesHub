package com.crinza.saleshub;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

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

    public static void notifyCallState(
            Context context,
            String state
    ) {

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
    // START RECORDING WORKFLOW
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

        JSObject result = new JSObject();

        result.put("success", true);
        result.put("callId", callId);

        result.put(
                "message",
                "Recording workflow started."
        );

        call.resolve(result);
    }

    // =========================================================
    // STOP RECORDING WORKFLOW
    // =========================================================

    @PluginMethod
    public void stopRecording(PluginCall call) {

        String callId = call.getString("callId");

        JSObject result = new JSObject();

        result.put("success", true);
        result.put("callId", callId);

        result.put(
                "message",
                "Recording workflow stopped."
        );

        call.resolve(result);
    }
}