package com.eldertree.elder_tree_mobile

import android.app.ActivityManager
import android.content.Intent
import android.os.Build
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject

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
                    if (state.isNullOrBlank() || !isValidLifeTreeState(state)) {
                        result.error(
                            "INVALID_LIFE_TREE_STATE",
                            "生命樹資料未通過原生啟動驗證。",
                            null,
                        )
                        return@setMethodCallHandler
                    }

                    val activity = unityGardenActivity()
                    if (activity == null) {
                        result.success(false)
                        return@setMethodCallHandler
                    }

                    val opened = runCatching {
                        startActivity(
                            Intent(this, activity).putExtra(LIFE_TREE_STATE_EXTRA, state),
                        )
                    }.isSuccess
                    result.success(opened)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun unityGardenActivity(): Class<*>? {
        if (!Build.SUPPORTED_64_BIT_ABIS.contains(UNITY_SUPPORTED_ABI)) return null

        val activityManager = getSystemService(ActivityManager::class.java)
        val supportsRequiredGraphics =
            activityManager.deviceConfigurationInfo.reqGlEsVersion >= REQUIRED_OPEN_GL_ES_VERSION
        if (!supportsRequiredGraphics || activityManager.isLowRamDevice) return null

        return runCatching { Class.forName(UNITY_PLAYER_ACTIVITY) }.getOrNull()
    }

    private fun isValidLifeTreeState(rawState: String): Boolean = runCatching {
        val state = JSONObject(rawState)
        if (state.optInt("schemaVersion", -1) != LIFE_TREE_SCHEMA_VERSION) return@runCatching false
        if (state.optInt("stageIndex", -1) !in MINIMUM_STAGE..MAXIMUM_STAGE) return@runCatching false

        val keepsakes = state.optJSONArray("keepsakes") ?: return@runCatching false
        val ids = mutableSetOf<String>()
        val slots = mutableSetOf<Int>()
        for (index in 0 until keepsakes.length()) {
            val keepsake = keepsakes.optJSONObject(index) ?: return@runCatching false
            val id = keepsake.optString("id").trim()
            val slot = keepsake.optInt("slotIndex", -1)
            val kind = keepsake.optString("kind")
            val color = keepsake.optString("color")
            if (id.isEmpty() || !ids.add(id)) return@runCatching false
            if (slot !in MINIMUM_SLOT..MAXIMUM_SLOT || !slots.add(slot)) return@runCatching false
            if (kind !in SUPPORTED_KEEPSAKE_KINDS || !HEX_COLOR.matches(color)) {
                return@runCatching false
            }
        }
        true
    }.getOrDefault(false)

    private companion object {
        const val LIFE_TREE_GARDEN_CHANNEL = "tree-companion/life-tree-garden"
        const val LIFE_TREE_STATE_EXTRA = "tree-companion.life-tree-state"
        const val UNITY_PLAYER_ACTIVITY = "com.unity3d.player.UnityPlayerGameActivity"
        const val UNITY_SUPPORTED_ABI = "arm64-v8a"
        const val REQUIRED_OPEN_GL_ES_VERSION = 0x00030000
        const val LIFE_TREE_SCHEMA_VERSION = 1
        const val MINIMUM_STAGE = 0
        const val MAXIMUM_STAGE = 5
        const val MINIMUM_SLOT = 0
        const val MAXIMUM_SLOT = 11
        val SUPPORTED_KEEPSAKE_KINDS =
            setOf("相聚果實", "季節枝", "公益葉", "探索花")
        val HEX_COLOR = Regex("^#[0-9A-Fa-f]{6}$")
    }
}
