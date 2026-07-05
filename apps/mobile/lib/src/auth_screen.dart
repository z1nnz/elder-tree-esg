import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'auth_service.dart';
import 'theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({required this.auth, super.key});

  final AuthService auth;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final formKey = GlobalKey<FormState>();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  bool registering = false;
  bool submitting = false;
  String? error;

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!(formKey.currentState?.validate() ?? false)) return;
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      if (registering) {
        await widget.auth.register(
          email: emailController.text,
          password: passwordController.text,
        );
      } else {
        await widget.auth.signIn(
          email: emailController.text,
          password: passwordController.text,
        );
      }
    } on FirebaseAuthException catch (exception) {
      setState(() => error = _messageFor(exception.code));
    } catch (_) {
      setState(() => error = '目前無法登入，請稍後再試。');
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Form(
                    key: formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Align(
                          child: Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: lime,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Icon(
                              Icons.spa_rounded,
                              color: forestDark,
                              size: 34,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          registering ? '建立綠伴帳號' : '登入綠伴',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          registering ? '建立帳號後，任務與家庭樹會安全保存。' : '回來看看今天的任務與家庭樹。',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFF66736C)),
                        ),
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: emailController,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          decoration: const InputDecoration(
                            labelText: '電子信箱',
                            prefixIcon: Icon(Icons.mail_outline_rounded),
                          ),
                          validator: (value) {
                            if (value == null ||
                                !value.contains('@') ||
                                value.trim().length < 5) {
                              return '請輸入有效的電子信箱';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: passwordController,
                          obscureText: true,
                          autofillHints: const [AutofillHints.password],
                          decoration: const InputDecoration(
                            labelText: '密碼',
                            prefixIcon: Icon(Icons.lock_outline_rounded),
                          ),
                          validator: (value) =>
                              (value?.length ?? 0) < 6 ? '密碼至少需要 6 個字元' : null,
                          onFieldSubmitted: (_) => submit(),
                        ),
                        if (error != null) ...[
                          const SizedBox(height: 14),
                          Text(
                            error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: submitting ? null : submit,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: submitting
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(registering ? '建立帳號' : '登入'),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: submitting
                              ? null
                              : () => setState(() {
                                  registering = !registering;
                                  error = null;
                                }),
                          child: Text(registering ? '已有帳號？直接登入' : '第一次使用？建立帳號'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _messageFor(String code) => switch (code) {
  'email-already-in-use' => '這個信箱已經註冊，請直接登入。',
  'invalid-credential' || 'wrong-password' || 'user-not-found' => '信箱或密碼不正確。',
  'operation-not-allowed' => 'Firebase 尚未開啟信箱登入。',
  'network-request-failed' => '網路連線失敗，請檢查網路後再試。',
  'weak-password' => '密碼強度不足，請使用至少 6 個字元。',
  _ => '登入失敗，請稍後再試。',
};
