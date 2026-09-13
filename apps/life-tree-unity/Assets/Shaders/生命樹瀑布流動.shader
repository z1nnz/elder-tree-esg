Shader "樹伴/生命樹瀑布流動"
{
    Properties
    {
        _Color ("水流陰影", Color) = (0.32,0.70,0.86,1)
        _FoamColor ("水沫亮色", Color) = (0.78,0.94,1,1)
        _FlowSpeed ("流動速度", Range(0,2)) = 0.42
        _VerticalDirection ("垂直流向", Float) = -1
        _FlowScale ("流紋密度", Range(0.2,8)) = 2.8
        _Opacity ("透明度", Range(0,1)) = 0.58
        _IsStream ("島面溪流", Float) = 0
    }

    SubShader
    {
        Tags
        {
            "Queue" = "Transparent"
            "RenderType" = "Transparent"
            "IgnoreProjector" = "True"
        }
        LOD 140
        Cull Off
        ZWrite Off
        Blend SrcAlpha OneMinusSrcAlpha

        Pass
        {
            CGPROGRAM
            #pragma vertex Vertex
            #pragma fragment Fragment
            #pragma multi_compile_fog
            #pragma target 3.0
            #include "UnityCG.cginc"

            fixed4 _Color;
            fixed4 _FoamColor;
            float _FlowSpeed;
            float _VerticalDirection;
            float _FlowScale;
            float _Opacity;
            float _IsStream;
            float _LifeTreeMotionTime;
            float _LifeTreeMotionAmount;

            struct AppData
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct Interpolators
            {
                float4 position : SV_POSITION;
                float3 worldPosition : TEXCOORD0;
                float2 uv : TEXCOORD1;
                UNITY_FOG_COORDS(2)
            };

            Interpolators Vertex(AppData input)
            {
                Interpolators output;
                float4 worldPosition = mul(unity_ObjectToWorld, input.vertex);
                float motionTime = _LifeTreeMotionTime * _LifeTreeMotionAmount;
                float sway = sin((worldPosition.y * 2.1 - motionTime * 1.4) * 3.2)
                    * 0.012 * _LifeTreeMotionAmount;
                // Keep the ripple at 1.2 cm even under FBX's unit conversion.
                worldPosition.x += sway * smoothstep(.18, .45, input.uv.y) * (1 - _IsStream);
                output.position = mul(UNITY_MATRIX_VP, worldPosition);
                output.worldPosition = worldPosition.xyz;
                output.uv = input.uv;
                UNITY_TRANSFER_FOG(output, output.position);
                return output;
            }

            float WaterNoise(float2 p)
            {
                float2 cell = floor(p);
                float2 blend = frac(p);
                blend = blend * blend * (3 - 2 * blend);
                float a = frac(sin(dot(cell, float2(127.1, 311.7))) * 43758.5453);
                float b = frac(sin(dot(cell + float2(1, 0), float2(127.1, 311.7))) * 43758.5453);
                float c = frac(sin(dot(cell + float2(0, 1), float2(127.1, 311.7))) * 43758.5453);
                float d = frac(sin(dot(cell + 1, float2(127.1, 311.7))) * 43758.5453);
                return lerp(lerp(a, b, blend.x), lerp(c, d, blend.x), blend.y);
            }

            fixed4 Fragment(Interpolators input) : SV_Target
            {
                float motionTime = _LifeTreeMotionTime * _LifeTreeMotionAmount;
                float u = input.uv.x;
                float v = input.uv.y;
                // Square-root travel coordinate stretches features as they
                // descend: the water speeds up after crossing the lip.
                float travel = sqrt(v + .04) * _FlowScale
                    + motionTime * _FlowSpeed * _VerticalDirection;
                // Aeration starts on the approach to the lip, not several
                // rows below it (which left a rigid translucent blue flap).
                float falling = smoothstep(.065, .20, v) * (1 - _IsStream);
                // Unequal, interrupted sheets of white water. Low-frequency
                // warp breaks parallel bands; fine grain travels WITH them.
                float warp = WaterNoise(float2(u * 4.1, travel * 8)) - .5;
                float strands = WaterNoise(float2(u * 27 + warp * 2.8, travel * 18));
                float sheets = WaterNoise(float2(u * 7.3 + warp, travel * 6.3 + 17));
                float grain = WaterNoise(float2(u * 63 + warp * 3, travel * 55));
                float foam = smoothstep(.36, .78, strands * .55 + sheets * .45);
                foam = saturate(foam * .8 + grain * foam * .35);
                float raggedEdge = lerp(.018, .025 + sheets * .09, falling);
                float edge = smoothstep(raggedEdge, raggedEdge + .06, u)
                    * smoothstep(raggedEdge, raggedEdge + .06, 1 - u);
                float endFade = 1 - smoothstep(.67, .98, v + (sheets - .5) * .20);
                // A river must reach the lip intact. Previously the shared
                // waterfall fade also erased its last quarter, exposing a seam.
                endFade = lerp(endFade, 1, _IsStream);
                float breakup = lerp(1, smoothstep(.17, .52, strands * .6 + sheets * .4), falling);
                float whiteWater = falling * (.64 + foam * .34);
                fixed4 colorSample = lerp(_Color, _FoamColor, saturate(whiteWater + foam * .22));
                colorSample.a = _Opacity * edge * endFade
                    * lerp(.78 + foam * .15, (.38 + foam * .62) * breakup, falling);
                UNITY_APPLY_FOG(input.fogCoord, colorSample);
                return colorSample;
            }
            ENDCG
        }
    }

    FallBack Off
}
