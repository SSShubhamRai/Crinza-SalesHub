package com.crinza.saleshub;

import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.provider.CallLog;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class CallSyncWorker extends Worker {

    private static final String TAG = "CallSyncWorker";

    public CallSyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    public static void enqueueSync(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        OneTimeWorkRequest syncRequest = new OneTimeWorkRequest.Builder(CallSyncWorker.class)
                .setConstraints(constraints)
                .build();

        WorkManager.getInstance(context).enqueue(syncRequest);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            Context context = getApplicationContext();
            JSONArray callsArray = new JSONArray();

            Cursor cursor = context.getContentResolver().query(
                    CallLog.Calls.CONTENT_URI,
                    null, null, null,
                    CallLog.Calls.DATE + " DESC"
            );

            if (cursor != null) {
                int idCol = cursor.getColumnIndex(CallLog.Calls._ID);
                int numberCol = cursor.getColumnIndex(CallLog.Calls.NUMBER);
                int typeCol = cursor.getColumnIndex(CallLog.Calls.TYPE);
                int dateCol = cursor.getColumnIndex(CallLog.Calls.DATE);
                int durationCol = cursor.getColumnIndex(CallLog.Calls.DURATION);

                int count = 0;
                while (cursor.moveToNext() && count < 20) { // Sync latest 20 calls
                    String callId = cursor.getString(idCol);
                    String number = cursor.getString(numberCol);
                    int typeInt = cursor.getInt(typeCol);
                    long timestamp = cursor.getLong(dateCol);
                    long duration = cursor.getLong(durationCol);

                    String typeStr = "UNKNOWN";
                    if (typeInt == CallLog.Calls.INCOMING_TYPE) typeStr = "INCOMING";
                    else if (typeInt == CallLog.Calls.OUTGOING_TYPE) typeStr = "OUTGOING";
                    else if (typeInt == CallLog.Calls.MISSED_TYPE) typeStr = "MISSED";
                    else if (typeInt == CallLog.Calls.REJECTED_TYPE) typeStr = "REJECTED";

                    JSONObject callObj = new JSONObject();
                    callObj.put("deviceCallLogId", callId);
                    callObj.put("phoneNumber", number != null ? number : "");
                    callObj.put("type", typeStr);
                    callObj.put("timestamp", timestamp);
                    callObj.put("durationSeconds", duration);
                    callObj.put("connected", duration > 0);

                    callsArray.put(callObj);
                    count++;
                }
                cursor.close();
            }

            if (callsArray.length() > 0) {
                JSONObject payload = new JSONObject();
                payload.put("calls", callsArray);

                // 🌟 Read Auth Token saved from Capacitor Preferences (CapacitorStorage)
                SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String authToken = prefs.getString("auth_token", "");

                // 🌟 Set your live production or development backend URL dynamically
                URL url = new URL("https://crinza-saleshub.onrender.com/api/salesperson/calls/sync");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setRequestProperty("Accept", "application/json");

                if (!authToken.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + authToken);
                }

                conn.setDoOutput(true);

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = payload.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    Log.d(TAG, "✅ Call logs successfully synced with CRM backend.");
                    return Result.success();
                } else {
                    Log.e(TAG, "❌ Failed to sync call logs. Response code: " + responseCode);
                    return Result.retry();
                }
            }

            return Result.success();
        } catch (Exception e) {
            Log.e(TAG, "🔥 Exception during background call log sync: " + e.getMessage());
            return Result.retry();
        }
    }
}