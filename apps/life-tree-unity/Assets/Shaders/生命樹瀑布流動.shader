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
            };

            struct Interpolators
            {
                float4 position : SV_POSITION;
                float3 worldPosition : TEXCOORD0;
                UNITY_FOG_COORDS(1)
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
                UNITY_TRANSFER_FOG(output, output.position);
                return output;
            }

            fixed4 Fragment(Interpolators input) : SV_Target
            {
                float motionTime = _LifeTreeMotionTime * _LifeTreeMotionAmount;
                float vertical = input.worldPosition.y * _FlowScale
                    - motionTime * _FlowSpeed * _VerticalDirection;
                float broadBand = pow(saturate(0.5 + 0.5 * sin(vertical * 6.28318)), 10.0);
                float fineBand = pow(saturate(0.5 + 0.5 * sin(
                    (vertical * 2.37 + input.worldPosition.x * 1.9) * 6.28318
                )), 16.0);
                float foam = saturate(broadBand * 0.30 + fineBand * 0.22);
                fixed4 colorSample = lerp(_Color, _FoamColor, foam * 0.62);
                colorSample.a = _Opacity * (0.91 + foam * 0.09);
                UNITY_APPLY_FOG(input.fogCoord, colorSample);
                return colorSample;
            }
            ENDCG
        }
    }

    FallBack Off
}
