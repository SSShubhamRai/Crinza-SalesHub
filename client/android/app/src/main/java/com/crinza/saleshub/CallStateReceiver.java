package com.crinza.saleshub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.telephony.TelephonyManager;
import android.util.Log;

public class CallStateReceiver extends BroadcastReceiver {

    private static final String TAG = "CallStateReceiver";

    private static String lastState = "";

    // ⏱️ Variables to track call duration
    private static long callStartTime = 0;
    private static boolean wasCalling = false;

    @Override
    public void onReceive(Context context, Intent intent) {

        if (intent == null) {
            return;
        }

        String action = intent.getAction();

        // Handle outgoing call interception if user dials natively
        if (Intent.ACTION_NEW_OUTGOING_CALL.equals(action)) {
            String outgoingNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER);
            Log.d(TAG, "📞 New Outgoing Call detected to: " + outgoingNumber);
            return;
        }

        if (!TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(action)) {
            return;
        }

        String state = intent.getStringExtra(
                TelephonyManager.EXTRA_STATE
        );

        if (state == null) {
            return;
        }

        Log.d(TAG, "📞 Phone state: " + state);

        if (state.equals(lastState)) {
            return;
        }

        lastState = state;

        // =====================================================
        // 📲 CALL CONNECTED / OFFHOOK
        // =====================================================

        if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(state)) {

            Log.d(TAG, "📲 CALL CONNECTED / OFFHOOK");

            // Start timer when call goes offhook (connected/dialing out)
            wasCalling = true;
            callStartTime = System.currentTimeMillis();

            CallRecordingPlugin.notifyCallState(
                    "connected"
            );

            return;
        }

        // =====================================================
        // 📴 CALL ENDED / IDLE
        // =====================================================

        if (TelephonyManager.EXTRA_STATE_IDLE.equals(state)) {

            Log.d(TAG, "📴 CALL ENDED / IDLE");

            long durationSeconds = 0;
            if (wasCalling && callStartTime > 0) {
                long callEndTime = System.currentTimeMillis();
                durationSeconds = (callEndTime - callStartTime) / 1000;
                wasCalling = false;
                callStartTime = 0;
            }

            CallRecordingPlugin.notifyCallStateWithDuration(
                    "ended",
                    durationSeconds
            );

            // 🌟 TRIGGER AUTOMATIC NATIVE CALL LOG SYNC BACK TO BACKEND
            if (context != null) {
                Log.d(TAG, "🔄 Triggering auto background call log sync to CRM backend...");
                
                // Delay slightly (3 seconds) to let Android write the latest call to system CallLog provider safely
                final Context appContext = context.getApplicationContext();
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    CallSyncWorker.enqueueSync(appContext);
                }, 3000);
            }

            return;
        }

        // =====================================================
        // 📞 INCOMING RINGING
        // =====================================================

        if (TelephonyManager.EXTRA_STATE_RINGING.equals(state)) {
            String incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
            Log.d(TAG, "📞 CALL RINGING from: " + (incomingNumber != null ? incomingNumber : "Unknown"));
            return;
        }
    }
}