Shader "樹伴/雲境天空"
{
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" }
        Cull Off ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex Vertex
            #pragma fragment Fragment
            #include "UnityCG.cginc"
            struct Input { float4 vertex:POSITION; };
            struct Output { float4 vertex:SV_POSITION; float3 direction:TEXCOORD0; };
            Output Vertex(Input input)
            {
                Output output;
                output.vertex = UnityObjectToClipPos(input.vertex);
                output.direction = input.vertex.xyz;
                return output;
            }
            fixed4 Fragment(Output input):SV_Target
            {
                float3 ray = normalize(input.direction);
                float high = smoothstep(-.65, .7, ray.y);
                fixed3 color = lerp(fixed3(.57,.79,.90), fixed3(.12,.39,.72), high);
                float sun = pow(saturate(dot(ray, normalize(float3(-.5,.6,.4)))), 18);
                return fixed4(color + sun * fixed3(.12,.10,.055), 1);
            }
            ENDCG
        }
    }
}
