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
                input.vertex.x += sway;
                output.position = UnityObjectToClipPos(input.vertex);
                output.worldPosition = mul(unity_ObjectToWorld, input.vertex).xyz;
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
                float strands = WaterNoise(float2(u * 7 + sin(travel * 1.6) * .35, travel * 4.0));
                float bubbles = WaterNoise(float2(u * 3.3 + 11, travel * 2.1));
                float lip = exp(-pow((v - .18) * 24, 2));
                float falling = smoothstep(.13, .28, v);
                float foam = saturate(.12 + pow(strands, 2) * .70 + bubbles * .20 + lip * .26);
                foam *= lerp(.42, 1, falling);
                float edge = smoothstep(0, .08, u) * smoothstep(0, .08, 1 - u);
                float endFade = 1 - smoothstep(.72, 1, v + .035 * sin(u * 53 + travel * 4));
                float breakup = lerp(.90, smoothstep(.08, .55, strands + bubbles * .30), smoothstep(.35, .95, v));
                fixed4 colorSample = lerp(_Color, _FoamColor, foam);
                colorSample.a = _Opacity * edge * endFade * breakup * (.62 + foam * .50);
                UNITY_APPLY_FOG(input.fogCoord, colorSample);
                return colorSample;
            }
            ENDCG
        }
    }

    FallBack Off
}
