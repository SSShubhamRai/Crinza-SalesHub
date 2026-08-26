package com.crinza.saleshub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.TelephonyManager;
import android.util.Log;

public class CallStateReceiver extends BroadcastReceiver {

    private static final String TAG = "CallStateReceiver";

    private static String lastState = "";

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
        // 📲 CALL CONNECTED
        // =====================================================

        if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(state)) {

            Log.d(TAG, "📲 CALL CONNECTED / OFFHOOK");

            CallRecordingPlugin.notifyCallState(
                    context,
                    "connected"
            );

            return;
        }

        // =====================================================
        // 📴 CALL ENDED
        // =====================================================

        if (TelephonyManager.EXTRA_STATE_IDLE.equals(state)) {

            Log.d(TAG, "📴 CALL ENDED / IDLE");

            CallRecordingPlugin.notifyCallState(
                    context,
                    "ended"
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