using System;
using System.Collections.Generic;
using UnityEngine;

namespace TreeCompanion.LifeTree
{
    [Serializable]
    public sealed class LifeTreeKeepsake
    {
        public string id = string.Empty;
        public int slotIndex;
        public string kind = string.Empty;
        public string label = string.Empty;
        public string color = "#D89B55";
    }

    [Serializable]
    public sealed class LifeTreeState
    {
        public const int CurrentSchemaVersion = 1;
        public const int MinimumStageIndex = 0;
        public const int MaximumStageIndex = 5;
        public const int KeepsakeSlotCount = 12;

        private static readonly HashSet<string> SupportedKinds = new HashSet<string>
        {
            "相聚果實",
            "季節枝",
            "公益葉",
            "探索花",
        };

        public int schemaVersion = CurrentSchemaVersion;
        public int stageIndex = MinimumStageIndex;
        public bool reduceMotion;
        public LifeTreeKeepsake[] keepsakes = Array.Empty<LifeTreeKeepsake>();

        public static bool TryParse(string json, out LifeTreeState state, out string error)
        {
            state = null;
            error = string.Empty;

            if (string.IsNullOrWhiteSpace(json))
            {
                error = "生命樹資料不可為空。";
                return false;
            }

            try
            {
                state = JsonUtility.FromJson<LifeTreeState>(json);
            }
            catch (ArgumentException)
            {
                error = "生命樹資料格式不正確。";
                return false;
            }

            return state != null && state.Validate(out error);
        }

        public bool Validate(out string error)
        {
            if (schemaVersion != CurrentSchemaVersion)
            {
                error = $"不支援的生命樹資料版本：{schemaVersion}。";
                return false;
            }

            if (stageIndex < MinimumStageIndex || stageIndex > MaximumStageIndex)
            {
                error = "生命樹成長階段超出範圍。";
                return false;
            }

            keepsakes ??= Array.Empty<LifeTreeKeepsake>();
            var ids = new HashSet<string>(StringComparer.Ordinal);
            var slots = new HashSet<int>();

            foreach (var keepsake in keepsakes)
            {
                if (keepsake == null || string.IsNullOrWhiteSpace(keepsake.id))
                {
                    error = "每個紀念物都必須有穩定識別碼。";
                    return false;
                }

                if (!ids.Add(keepsake.id))
                {
                    error = $"紀念物識別碼重複：{keepsake.id}。";
                    return false;
                }

                if (keepsake.slotIndex < 0 || keepsake.slotIndex >= KeepsakeSlotCount)
                {
                    error = $"紀念物掛點超出範圍：{keepsake.slotIndex}。";
                    return false;
                }

                if (!slots.Add(keepsake.slotIndex))
                {
                    error = $"紀念物掛點重複：{keepsake.slotIndex}。";
                    return false;
                }

                if (!SupportedKinds.Contains(keepsake.kind))
                {
                    error = $"不支援的紀念物種類：{keepsake.kind}。";
                    return false;
                }

                if (!ColorUtility.TryParseHtmlString(keepsake.color, out _))
                {
                    error = $"紀念物色彩格式不正確：{keepsake.color}。";
                    return false;
                }
            }

            error = string.Empty;
            return true;
        }
    }
}
