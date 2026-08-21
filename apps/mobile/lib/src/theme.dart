import 'package:flutter/material.dart';

const forest = Color(0xFF176B4A);
const forestDark = Color(0xFF0F4F38);
const lime = Color(0xFFB9DB68);
const warmYellow = Color(0xFFF4C95D);
const coral = Color(0xFFEF755F);
const ink = Color(0xFF17201C);
const canvas = Color(0xFFF5F7F5);
const warmWhite = Color(0xFFFFFDF7);
const cream = Color(0xFFFFF7DE);
const skyMint = Color(0xFFDFF8E8);
const mutedInk = Color(0xFF536159);
const outline = Color(0xFFD8E1DB);

ThemeData buildAppTheme(bool elderMode) {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: forest,
      primary: forest,
      secondary: warmYellow,
      surface: warmWhite,
      error: const Color(0xFFB74334),
    ),
    scaffoldBackgroundColor: warmWhite,
    fontFamilyFallback: const [
      'PingFang TC',
      'Noto Sans TC',
      'Microsoft JhengHei',
    ],
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: warmWhite,
      surfaceTintColor: Colors.transparent,
      foregroundColor: ink,
    ),
    textTheme: base.textTheme
        .apply(bodyColor: ink, displayColor: ink)
        .copyWith(
          headlineSmall: base.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
          titleLarge: base.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
          titleMedium: base.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: 0,
          ),
        ),
    cardTheme: const CardThemeData(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: warmWhite,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
        side: BorderSide(color: outline),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      height: 72,
      backgroundColor: Colors.white,
      indicatorColor: Color(0xFFDCEBDF),
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontWeight: FontWeight.w700, letterSpacing: 0),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: Size(48, elderMode ? 54 : 48),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontWeight: FontWeight.w800,
          letterSpacing: 0,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: Size(48, elderMode ? 54 : 48),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontWeight: FontWeight.w800,
          letterSpacing: 0,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: Size(48, elderMode ? 54 : 48),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: Size(48, elderMode ? 54 : 48)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: forest,
      linearTrackColor: Color(0xFFE2E9E4),
    ),
    dividerTheme: const DividerThemeData(color: outline, space: 1),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: const Color(0xFFEEF4EF),
      side: const BorderSide(color: outline),
      labelStyle: const TextStyle(color: ink, fontWeight: FontWeight.w700),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(7)),
        borderSide: BorderSide(color: Color(0xFFD2DAD5)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(7)),
        borderSide: BorderSide(color: Color(0xFFD2DAD5)),
      ),
    ),
  );
}
