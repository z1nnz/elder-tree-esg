Shader "樹伴/生命樹葉簇裁切"
{
    Properties
    {
        _Color ("色彩", Color) = (1,1,1,1)
        _MainTex ("葉簇貼圖", 2D) = "white" {}
        _Cutoff ("透明裁切門檻", Range(0,1)) = 0.28
        _WindStrength ("葉簇風動幅度", Range(0,0.002)) = 0.00032
    }

    SubShader
    {
        Tags
        {
            "Queue" = "AlphaTest"
            "RenderType" = "TransparentCutout"
            "IgnoreProjector" = "True"
        }
        LOD 200
        Cull Off
        ZWrite On

        CGPROGRAM
        #pragma surface Surface Lambert alphatest:_Cutoff addshadow vertex:Vertex
        #pragma target 3.0

        sampler2D _MainTex;
        fixed4 _Color;
        float _WindStrength;
        float _LifeTreeMotionTime;
        float _LifeTreeMotionAmount;

        struct Input
        {
            float2 uv_MainTex;
        };

        void Vertex(inout appdata_full input)
        {
            float3 worldPosition = mul(unity_ObjectToWorld, input.vertex).xyz;
            float phase = worldPosition.x * 0.73 + worldPosition.z * 0.41;
            float time = _LifeTreeMotionTime * _LifeTreeMotionAmount;
            float wave = sin(time * 1.65 + phase + worldPosition.y * 0.52);
            float secondary = sin(time * 0.91 + phase * 1.37) * 0.34;
            float upperWeight = saturate(input.vertex.y * 0.72 + 0.58);
            input.vertex.x += (wave + secondary) * _WindStrength
                * _LifeTreeMotionAmount * (0.42 + upperWeight * 0.58);
            input.vertex.z += secondary * _WindStrength * 0.28
                * _LifeTreeMotionAmount * upperWeight;
        }

        void Surface(Input input, inout SurfaceOutput output)
        {
            fixed4 colorSample = tex2D(_MainTex, input.uv_MainTex) * _Color;
            output.Albedo = colorSample.rgb;
            output.Alpha = colorSample.a;
        }
        ENDCG
    }

    FallBack "Transparent/Cutout/VertexLit"
}
