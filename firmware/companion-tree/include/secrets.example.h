#pragma once

// Copy this file to include/secrets.h and replace each placeholder.
// Never commit private keys or device certificates.

constexpr char kAwsIotEndpoint[] = "example-ats.iot.ap-northeast-1.amazonaws.com";

constexpr char kRootCa[] = R"EOF(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_AMAZON_ROOT_CA_1
-----END CERTIFICATE-----
)EOF";

constexpr char kDeviceCertificate[] = R"KEY(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_DEVICE_CERTIFICATE
-----END CERTIFICATE-----
)KEY";

constexpr char kDevicePrivateKey[] = R"KEY(
-----BEGIN RSA PRIVATE KEY-----
REPLACE_WITH_DEVICE_PRIVATE_KEY
-----END RSA PRIVATE KEY-----
)KEY";
