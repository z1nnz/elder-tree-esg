import 'dart:typed_data';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:image/image.dart' as image;
import 'package:image_picker/image_picker.dart';

import 'models.dart';

class UploadedEvidence {
  const UploadedEvidence({required this.sha256});

  final String sha256;
}

class PreparedPhotoEvidence {
  const PreparedPhotoEvidence({
    required this.base64Image,
    required this.contentType,
    required this.sha256,
  });

  final String base64Image;
  final String contentType;
  final String sha256;
}

Future<PreparedPhotoEvidence> preparePhotoEvidence(XFile photo) async {
  final sanitized = await sanitizePhotoEvidence(photo);
  return PreparedPhotoEvidence(
    base64Image: base64Encode(sanitized),
    contentType: 'image/jpeg',
    sha256: sha256.convert(sanitized).toString(),
  );
}

Future<Uint8List> sanitizePhotoEvidence(XFile photo) async {
  final source = await photo.readAsBytes();
  final decoded = image.decodeImage(source);
  if (decoded == null) {
    throw const FormatException('無法讀取這張照片');
  }
  final oriented = image.bakeOrientation(decoded);
  final resized = oriented.width > 1600
      ? image.copyResize(oriented, width: 1600)
      : oriented;
  final sanitized = Uint8List.fromList(image.encodeJpg(resized, quality: 82));
  if (sanitized.length > 10 * 1024 * 1024) {
    throw const FormatException('照片處理後仍超過 10 MB');
  }
  return sanitized;
}

abstract class EvidenceUploader {
  Future<UploadedEvidence> upload(XFile photo, EvidenceUploadModel destination);
}

class FirebaseEvidenceUploader implements EvidenceUploader {
  FirebaseEvidenceUploader({FirebaseStorage? storage})
    : _storage = storage ?? FirebaseStorage.instance;

  final FirebaseStorage _storage;

  @override
  Future<UploadedEvidence> upload(
    XFile photo,
    EvidenceUploadModel destination,
  ) async {
    final sanitized = await sanitizePhotoEvidence(photo);
    await _storage
        .ref(destination.storagePath)
        .putData(
          sanitized,
          SettableMetadata(
            contentType: 'image/jpeg',
            customMetadata: {'evidenceId': destination.id},
          ),
        );
    return UploadedEvidence(sha256: sha256.convert(sanitized).toString());
  }
}
