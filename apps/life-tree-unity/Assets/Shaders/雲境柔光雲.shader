Shader "樹伴/雲境柔光雲"
{
    Properties
    {
        _Top ("雲頂暖光", Color) = (.98,.98,.94,1)
        _Bottom ("雲底冷色", Color) = (.66,.81,.9,1)
        _Seed ("雲形差異", Range(0,1)) = .5
    }
    SubShader
    {
        // CPU dynamic batching rewrites vertices into world space, which would
        // invalidate the per-volume local ray/box intersection.
        Tags { "RenderType"="Transparent" "Queue"="Transparent-20" "DisableBatching"="True" }
        Blend One OneMinusSrcAlpha
        ZWrite Off
        Cull Back
        Pass
        {
            CGPROGRAM
            #pragma vertex Vertex
            #pragma fragment Fragment
            #pragma multi_compile_fog
            #pragma target 3.0
            #include "UnityCG.cginc"
            float4 _Top, _Bottom;
            float _Seed;
            struct Varyings { float4 vertex:SV_POSITION; float3 local:TEXCOORD0; UNITY_FOG_COORDS(1) };
            Varyings Vertex(float4 vertex:POSITION)
            {
                Varyings o;
                o.vertex = UnityObjectToClipPos(vertex);
                o.local = vertex.xyz * 2;
                UNITY_TRANSFER_FOG(o, o.vertex);
                return o;
            }
            float Hash(float3 p)
            {
                p = frac(p * .1031);
                p += dot(p, p.yzx + 33.33);
                return frac((p.x + p.y) * p.z);
            }
            float Noise(float3 p)
            {
                float3 cell = floor(p), f = frac(p);
                f = f * f * (3 - 2 * f);
                return lerp(lerp(lerp(Hash(cell), Hash(cell + float3(1,0,0)), f.x),
                                 lerp(Hash(cell + float3(0,1,0)), Hash(cell + float3(1,1,0)), f.x), f.y),
                            lerp(lerp(Hash(cell + float3(0,0,1)), Hash(cell + float3(1,0,1)), f.x),
                                 lerp(Hash(cell + float3(0,1,1)), Hash(cell + 1), f.x), f.y), f.z);
            }
            float Density(float3 p, float3 up)
            {
                float3 right = normalize(cross(up,float3(.23,.83,.4)));
                float3 q = float3(dot(p,right),dot(p,up),dot(p,cross(right,up)));
                // Overlapping unequal lobes, not two identical stacked balls.
                float shape = 1-length((q-float3(0,-.30,0))/float3(.88,.34,.66));
                shape = max(shape, 1-length((q-float3(-.31,.02+_Seed*.16,0))/float3(.45,.60,.64)));
                shape = max(shape, 1-length((q-float3(.28,-.04,.08))/float3(.50,.48,.60)));
                shape = max(shape, 1-length((q-float3(-.03,.14,.16))/float3(.43,.54,.50)));
                shape = max(shape, 1-length((q-float3(-.65,-.28,.05))/float3(.31,.28,.43)));
                shape = max(shape, 1-length((q-float3(.64,-.30,-.06))/float3(.33,.31,.45)));
                float3 seed = float3(_Seed*13,_Seed*5,_Seed*7);
                float detail = Noise(p*3.6+seed) * .65 + Noise(p*8.2+seed) * .35;
                return saturate(shape * 3.8 - .4 - detail);
            }
            float4 Fragment(Varyings i):SV_Target
            {
                float3 origin = mul(unity_WorldToObject, float4(_WorldSpaceCameraPos,1)).xyz * 2;
                float3 direction = normalize(i.local - origin);
                float3 inverse = 1 / ((step(0,direction)*2-1) * max(abs(direction), .0001));
                float3 a = (-1-origin) * inverse, b = (1-origin) * inverse;
                float3 lo = min(a,b), hi = max(a,b);
                float entry = max(0, max(lo.x,max(lo.y,lo.z)));
                float leave = min(hi.x,min(hi.y,hi.z));
                if (leave <= entry) discard;
                float3 up = normalize(mul((float3x3)unity_WorldToObject, float3(0,1,0)));
                float stepSize = (leave-entry)/28;
                float3 light = 0;
                float opacity = 0;
                [loop] for(int sampleIndex=0; sampleIndex<28; sampleIndex++)
                {
                    float3 p = origin + direction * (entry + (sampleIndex+.5)*stepSize);
                    float absorption = 1-exp(-Density(p,up)*stepSize*11);
                    float3 tint = lerp(_Bottom.rgb,_Top.rgb,smoothstep(-.65,.70,dot(p,up)));
                    tint *= .75 + .25*exp(-Density(p+up*.20,up)*1.5);
                    light += (1-opacity) * tint * absorption;
                    opacity += (1-opacity) * absorption;
                    if(opacity>.985) break;
                }
                if(opacity<.002) discard;
                float4 color = float4(light / max(opacity,.001), opacity);
                UNITY_APPLY_FOG(i.fogCoord,color);
                color.rgb *= opacity;
                return color;
            }
            ENDCG
        }
    }
}
