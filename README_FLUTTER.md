
# CareXAI Flutter Deployment

To ensure the Video Consultation and Medical Records features work correctly on mobile, add these permissions to your native files:

## Android (android/app/src/main/AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
```

## iOS (ios/Runner/Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>CareXAI needs camera access for video consultations.</string>
<key>NSMicrophoneUsageDescription</key>
<string>CareXAI needs microphone access for video consultations.</string>
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```
