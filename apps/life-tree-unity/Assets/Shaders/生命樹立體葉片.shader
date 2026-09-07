Shader "樹伴/生命樹立體葉片"
{
    Properties
    {
        _Color ("葉色調整", Color) = (1,1,1,1)
        _WindStrength ("微風幅度", Range(0,0.002)) = 0.00032
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Cull Off
        CGPROGRAM
        #pragma surface Surface Standard vertex:Vertex addshadow
        #pragma target 3.0
        fixed4 _Color;
        float _WindStrength;
        float _LifeTreeMotionTime;
        float _LifeTreeMotionAmount;
        struct Input { float4 color : COLOR; float facing : VFACE; };
        void Vertex(inout appdata_full v)
        {
            float3 world = mul(unity_ObjectToWorld, v.vertex).xyz;
            float phase = world.x * 0.73 + world.z * 0.41;
            float wave = sin(_LifeTreeMotionTime * 1.65 + phase + world.y * 0.52);
            v.vertex.x += wave * _WindStrength * _LifeTreeMotionAmount;
            v.vertex.z += sin(_LifeTreeMotionTime * 0.91 + phase) * _WindStrength
                * 0.28 * _LifeTreeMotionAmount;
        }
        void Surface(Input input, inout SurfaceOutputStandard output)
        {
            output.Albedo = input.color.rgb * _Color.rgb;
            output.Normal = float3(0, 0, input.facing >= 0 ? 1 : -1);
            output.Metallic = 0;
            output.Smoothness = 0.12;
            output.Occlusion = 1;
            output.Alpha = 1;
        }
        ENDCG
    }
    Fallback "Diffuse"
}
