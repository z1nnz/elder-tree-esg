Shader "樹伴/生命樹葉簇裁切"
{
    Properties
    {
        _Color ("色彩", Color) = (1,1,1,1)
        _MainTex ("葉簇貼圖", 2D) = "white" {}
        _Cutoff ("透明裁切門檻", Range(0,1)) = 0.28
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
        #pragma surface Surface Lambert alphatest:_Cutoff addshadow
        #pragma target 3.0

        sampler2D _MainTex;
        fixed4 _Color;

        struct Input
        {
            float2 uv_MainTex;
        };

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
