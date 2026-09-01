Shader "樹伴/生命樹浮島三向材質"
{
    Properties
    {
        _Color ("整體色彩", Color) = (1,1,1,1)
        _GrassTex ("草地色彩", 2D) = "white" {}
        _RockTex ("岩層色彩", 2D) = "gray" {}
        _Tiling ("三向貼圖密度", Range(0.05, 2)) = 0.42
        _GrassInfluence ("頂面草地比例", Range(0,1)) = 1
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" }
        LOD 220
        Cull Back
        ZWrite On

        CGPROGRAM
        #pragma surface Surface Lambert addshadow
        #pragma target 3.0

        sampler2D _GrassTex;
        sampler2D _RockTex;
        fixed4 _Color;
        half _Tiling;
        half _GrassInfluence;

        struct Input
        {
            float3 worldPos;
            float3 worldNormal;
        };

        fixed4 SampleRock(float3 position, float3 normal)
        {
            float3 weight = pow(abs(normal), 4.0);
            weight /= max(weight.x + weight.y + weight.z, 0.0001);
            fixed4 alongX = tex2D(_RockTex, position.zy * _Tiling);
            fixed4 alongY = tex2D(_RockTex, position.xz * _Tiling);
            fixed4 alongZ = tex2D(_RockTex, position.xy * _Tiling);
            return alongX * weight.x + alongY * weight.y + alongZ * weight.z;
        }

        void Surface(Input input, inout SurfaceOutput output)
        {
            float3 normal = normalize(input.worldNormal);
            fixed4 rock = SampleRock(input.worldPos, normal);
            fixed4 grass = tex2D(_GrassTex, input.worldPos.xz * _Tiling);
            half upward = smoothstep(0.46, 0.74, normal.y) * _GrassInfluence;
            fixed4 colorSample = lerp(rock, grass, upward) * _Color;
            output.Albedo = colorSample.rgb;
            output.Alpha = 1.0;
        }
        ENDCG
    }

    FallBack "Diffuse"
}
