Shader "樹伴/雲境柔光雲"
{
    Properties
    {
        _Top ("雲頂暖光", Color) = (.98,.98,.94,1)
        _Bottom ("雲底冷色", Color) = (.55,.72,.84,1)
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 150
        CGPROGRAM
        #pragma surface Surface Lambert
        #pragma target 3.0
        fixed4 _Top, _Bottom;
        struct Input { float3 worldNormal; float3 viewDir; };
        void Surface(Input input, inout SurfaceOutput output)
        {
            half heightLight = smoothstep(-.8, .65, normalize(input.worldNormal).y);
            half rim = pow(1 - saturate(dot(normalize(input.viewDir), float3(0,0,1))), 2);
            fixed3 color = lerp(_Bottom.rgb, _Top.rgb, heightLight);
            // Broad soft illumination, deliberately no glossy/specular response.
            output.Albedo = color * .42;
            output.Emission = color * (.50 + rim * .08);
            output.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
