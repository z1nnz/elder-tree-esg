using System;

namespace TreeCompanion.LifeTree
{
    /// <summary>Local construction prototype; never grants real action rewards.</summary>
    [Serializable]
    public sealed class CloudGardenLayout
    {
        public const int PlotCount = 3;
        public int plantedMask;
        public bool IsPlanted(int plot) => Valid(plot) && (plantedMask & (1 << plot)) != 0;
        public bool Plant(int plot)
        {
            if (!Valid(plot) || IsPlanted(plot)) return false;
            plantedMask |= 1 << plot;
            return true;
        }
        public bool Remove(int plot)
        {
            if (!IsPlanted(plot)) return false;
            plantedMask &= ~(1 << plot);
            return true;
        }
        public bool IsValid => plantedMask >= 0 && plantedMask < (1 << PlotCount);
        private static bool Valid(int plot) => plot >= 0 && plot < PlotCount;
    }
}
