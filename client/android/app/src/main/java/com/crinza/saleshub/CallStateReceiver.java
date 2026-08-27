package com.crinza.saleshub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
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

        if (!TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(
                intent.getAction())) {
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
                    context,
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

            // Notify plugin with exact duration
            CallRecordingPlugin.notifyCallStateWithDuration(
                    context,
                    "ended",
                    durationSeconds
            );

            return;
        }

        // =====================================================
        // 📞 INCOMING RINGING
        // =====================================================

        if (TelephonyManager.EXTRA_STATE_RINGING.equals(state)) {

            Log.d(TAG, "📞 CALL RINGING");

            return;
        }
    }
}