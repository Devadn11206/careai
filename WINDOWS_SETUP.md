# CareXAI Mobile App - Windows Developer Setup

## Overview
This guide helps Windows developers set up CareXAI for iOS and Android development.

---

## ⚠️ iOS Development Note
**iOS development requires macOS.** If you're on Windows:
- ❌ Cannot build iOS apps on Windows directly
- ✅ Can only build Android apps
- ✅ Consider using a Mac, Virtual Machine, or cloud build service (like GitHub Actions)

---

## 🤖 Android Development on Windows

### Prerequisites
1. **Java Development Kit (JDK) 11+**
   ```powershell
   # Verify Java installation
   java -version
   ```
   - Download from: https://www.oracle.com/java/technologies/downloads/

2. **Android Studio**
   - Download: https://developer.android.com/studio
   - Accept all SDK licenses during installation
   - Install API Level 34+ (latest)

3. **Environment Variables**
   - Set `JAVA_HOME` to your JDK installation
   - Set `ANDROID_HOME` to your Android SDK path
   
   **Windows Path Setup:**
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"  # or your version
   $env:ANDROID_HOME = "C:\Users\{username}\AppData\Local\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
   ```

### Quick Start

1. **Build Web App**
   ```powershell
   cd CAREXAI\careai
   npm run build
   npm run cap:sync
   ```

2. **Open Android Studio**
   ```powershell
   npm run cap:android:run
   # Or manually:
   npx cap open android
   ```

3. **Run on Device/Emulator**
   - Select device from top toolbar in Android Studio
   - Click ▶ Play button
   - App will build and install on device

### Testing on Real Device

**Enable Developer Mode:**
1. Settings → About Phone
2. Tap Build Number 7 times
3. Go back, find Developer Options
4. Enable USB Debugging
5. Connect phone via USB
6. Select device in Android Studio
7. Click Play

### Build for Google Play

```powershell
# Create signing key (first time only)
# In PowerShell:
$projectPath = "C:\Users\ddnan\CAREXAI\careai\android\app"

# Android Studio handles this now, but you can also:
# Build → Generate Signed Bundle/APK
```

---

## 🍎 iOS Development Options for Windows Users

### Option 1: Use macOS (Recommended)
- Most reliable
- Get a MacBook or Mac Mini for development

### Option 2: Cloud Build Services
Use GitHub Actions to build iOS:

```yaml
# .github/workflows/ios-build.yml
name: Build iOS
on: [push]
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - run: npm run cap:sync
      - run: npm run cap:ios:build
```

### Option 3: Remote Mac (SSH)
Connect to a Mac via SSH and build remotely:

```powershell
ssh user@mac-address
cd ~/path/to/CAREXAI/careai
npm run cap:ios:run
```

### Option 4: MacOS VM
Run macOS in a virtual machine (VMware, Parallels, VirtualBox)

---

## 🔧 Development Workflow on Windows

### 1. Development Loop
```powershell
# Terminal 1: Watch for file changes (optional)
npm run dev

# Terminal 2: After changes, sync to native
npm run build
npm run cap:sync

# Then rebuild in Android Studio (Ctrl+B)
```

### 2. Testing Changes
```powershell
# Connect device or start emulator
npm run cap:android:run

# Or if already running:
npm run build
npm run cap:sync
# Press R in Android Studio to reload
```

### 3. Debugging
```powershell
# View Android logs
cd android
./gradlew logcat
```

---

## 📁 File Locations

| Item | Windows Location |
|------|-----------------|
| Project | `C:\Users\{username}\CAREXAI\careai` |
| Android | `C:\Users\{username}\CAREXAI\careai\android` |
| Java | `C:\Program Files\Java\jdk-{version}` |
| Android SDK | `C:\Users\{username}\AppData\Local\Android\Sdk` |
| Gradle Cache | `C:\Users\{username}\.gradle` |

---

## ⚠️ Common Windows Issues & Solutions

### Issue: "Android SDK Not Found"
```powershell
# Solution: Set ANDROID_HOME variable
$env:ANDROID_HOME = "C:\Users\{username}\AppData\Local\Android\Sdk"
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $env:ANDROID_HOME, "User")
```

### Issue: "Gradle Build Failed"
```powershell
# Solution: Clean gradle cache
cd C:\Users\ddnan\CAREXAI\careai\android
.\gradlew clean
.\gradlew build
```

### Issue: "Device Not Found"
```powershell
# Solution: Check USB drivers and ADB
adb devices
# Install Google USB Driver from Android Studio
```

### Issue: "Java Version Not Supported"
```powershell
# Check Java version
java -version

# Must be JDK 11 or higher
# Download from: https://www.oracle.com/java/technologies/downloads/
```

### Issue: Port 5037 Already in Use (ADB)
```powershell
# Kill existing adb
adb kill-server
adb start-server
```

---

## ✅ Verification Checklist

- [ ] Java JDK 11+ installed (`java -version`)
- [ ] Android Studio installed
- [ ] Android SDK API 34+ installed
- [ ] `JAVA_HOME` environment variable set
- [ ] `ANDROID_HOME` environment variable set
- [ ] `npm install` completed
- [ ] `npm run build` succeeds
- [ ] `npm run cap:sync` succeeds
- [ ] Device shows in `adb devices`
- [ ] App runs on emulator or real device

---

## 📚 Useful Commands for Windows

```powershell
# Check ADB devices
adb devices

# Restart ADB server
adb kill-server; adb start-server

# View device logs
adb logcat

# Install APK manually
adb install -r app.apk

# Clear app data
adb shell pm clear com.carexai.healthcare

# Reboot device
adb reboot
```

---

## 📖 Next Steps

1. ✅ **Install Prerequisites** (Java, Android Studio)
2. ✅ **Set Environment Variables** (JAVA_HOME, ANDROID_HOME)
3. ✅ **Run**: `npm run build && npm run cap:sync`
4. ✅ **Open**: `npm run cap:android:run`
5. ✅ **Test** on emulator or real device
6. ✅ **Submit** to Google Play when ready

---

## 🆘 Support

- [Android Studio Docs](https://developer.android.com/studio/intro)
- [Capacitor Android Docs](https://capacitorjs.com/docs/android)
- [ADB Reference](https://developer.android.com/studio/command-line/adb)
- [Google Play Console](https://play.google.com/console)

---

## 🍎 For iOS (macOS Only)

See [MOBILE_APP_DEPLOYMENT.md](./MOBILE_APP_DEPLOYMENT.md) for iOS setup instructions.
