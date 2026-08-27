import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

// System controls and accessibility announcements must match the Chinese UI.
const appLocale = Locale.fromSubtags(
  languageCode: 'zh',
  scriptCode: 'Hant',
  countryCode: 'TW',
);
const appSupportedLocales = [appLocale];
const appLocalizationDelegates = GlobalMaterialLocalizations.delegates;
