package com.crinza.saleshub;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class LocationService extends Service implements LocationListener {
    private LocationManager locationManager;
    private static final String CHANNEL_ID = "LocationServiceChannel";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Field Tracking Active")
                .setContentText("Running in background...")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .build();

        startForeground(1, notification);

        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            if (locationManager != null) {
                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        10000, 
                        20, 
                        this
                );
            }
        } catch (SecurityException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        SharedPreferences prefs = getSharedPreferences("AppPrefs", MODE_PRIVATE);
        boolean isLoggedIn = prefs.getBoolean("isLoggedIn", false);
        String salespersonId = prefs.getString("salespersonId", "");

        if (isLoggedIn && !salespersonId.isEmpty()) {
            double latitude = location.getLatitude();
            double longitude = location.getLongitude();

            new Thread(() -> sendLocationToServer(salespersonId, latitude, longitude)).start();
        }
    }

    private void sendLocationToServer(String salespersonId, double lat, double lng) {
        try {
            URL url = new URL("https://your-backend-server.com/api/track-location");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setDoOutput(true);

            String jsonInputString = "{\"salespersonId\": \"" + salespersonId + "\", \"latitude\": " + lat + ", \"longitude\": " + lng + "}";

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonInputString.getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            conn.getResponseCode();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Location Service Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
    }
}