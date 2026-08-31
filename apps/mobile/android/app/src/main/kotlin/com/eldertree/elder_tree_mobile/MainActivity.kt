package com.eldertree.elder_tree_mobile

import android.content.Intent
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            LIFE_TREE_GARDEN_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "isAvailable" -> result.success(unityGardenActivity() != null)
                "open" -> {
                    val state = call.argument<String>("state")
                    if (state.isNullOrBlank()) {
                        result.error(
                            "INVALID_LIFE_TREE_STATE",
                            "生命樹資料不可為空。",
                            null,
                        )
                        return@setMethodCallHandler
                    }

                    val activity = unityGardenActivity()
                    if (activity == null) {
                        result.success(false)
                        return@setMethodCallHandler
                    }

                    startActivity(
                        Intent(this, activity).putExtra(LIFE_TREE_STATE_EXTRA, state),
                    )
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun unityGardenActivity(): Class<*>? =
        runCatching { Class.forName(UNITY_PLAYER_ACTIVITY) }.getOrNull()

    private companion object {
        const val LIFE_TREE_GARDEN_CHANNEL = "tree-companion/life-tree-garden"
        const val LIFE_TREE_STATE_EXTRA = "tree-companion.life-tree-state"
        const val UNITY_PLAYER_ACTIVITY = "com.unity3d.player.UnityPlayerGameActivity"
    }
}
