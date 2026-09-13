Shader "樹伴/雲境遠海"
{
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Pass
        {
            CGPROGRAM
            #pragma vertex Vertex
            #pragma fragment Fragment
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            float _LifeTreeMotionTime;
            float _LifeTreeMotionAmount;
            struct Input { float4 vertex:POSITION; };
            struct Output { float4 position:SV_POSITION; float3 world:TEXCOORD0; UNITY_FOG_COORDS(1) };
            Output Vertex(Input input)
            {
                Output o;
                float3 p = mul(unity_ObjectToWorld,input.vertex).xyz;
                float t = _LifeTreeMotionTime * _LifeTreeMotionAmount;
                p.y += sin(p.x*.33 + p.z*.18 + t*.24)*.12
                     + sin(p.z*.51 - t*.17)*.06;
                o.world=p; o.position=mul(UNITY_MATRIX_VP,float4(p,1));
                UNITY_TRANSFER_FOG(o,o.position);
                return o;
            }
            float Noise(float2 p)
            {
                float2 cell=floor(p), f=frac(p);
                f=f*f*(3-2*f);
                float a=frac(sin(dot(cell,float2(127.1,311.7)))*43758.54);
                float b=frac(sin(dot(cell+float2(1,0),float2(127.1,311.7)))*43758.54);
                float c=frac(sin(dot(cell+float2(0,1),float2(127.1,311.7)))*43758.54);
                float d=frac(sin(dot(cell+1,float2(127.1,311.7)))*43758.54);
                return lerp(lerp(a,b,f.x),lerp(c,d,f.x),f.y);
            }
            fixed4 Fragment(Output input):SV_Target
            {
                float t = _LifeTreeMotionTime * _LifeTreeMotionAmount;
                float2 p = input.world.xz;
                float ripple = Noise(p*float2(.8,1.4)+float2(t*.04,0));
                float broad = Noise(p*.10)*.7+Noise(p*.23)*.3;
                fixed3 color = lerp(fixed3(.025,.22,.39),fixed3(.06,.43,.57),broad);
                float gleam = pow(saturate(ripple),5)*.045;
                color += gleam * fixed3(.42,.70,.78);
                float distance = length(_WorldSpaceCameraPos.xz-p);
                float3 ray=normalize(input.world-_WorldSpaceCameraPos);
                float high=smoothstep(-.65,.7,ray.y);
                fixed3 sky=lerp(fixed3(.57,.79,.90),fixed3(.12,.39,.72),high);
                color = lerp(color,sky,smoothstep(70,150,distance));
                fixed4 result = fixed4(color,1);
                // Distance already blends to the same sky colour. Applying
                // scene fog again would reveal a hard rectangular horizon.
                return result;
            }
            ENDCG
        }
    }
}
