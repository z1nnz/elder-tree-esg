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
                float3 seed = float3(_Seed*13,_Seed*5,_Seed*7);
                // Seed changes the silhouette, not just the surface noise:
                // shallow banks, off-centre towers and broken trailing wisps.
                float tower = smoothstep(.15,.85,_Seed);
                float lean = (_Seed-.5)*.55;
                q.x += (Noise(q*3.2+seed)-.5)*.17;
                q.y += (Noise(q*4.1+seed.yzx)-.5)*.13;
                float shape = 1-length((q-float3(0,-.27,0))/float3(.91,.32,.64));
                shape = max(shape, 1-length((q-float3(-.29+lean,-.15+tower*.29,-.04))
                    /float3(.44+tower*.07,.26+tower*.36,.46)));
                shape = max(shape, 1-length((q-float3(.23+lean*.3,-.12,.11))
                    /float3(.44,.31+(1-tower)*.13,.57)));
                shape = max(shape, 1-length((q-float3(-.06-lean,-.03+tower*.12,.20))
                    /float3(.31,.28+tower*.22,.41)));
                shape = max(shape, 1-length((q-float3(-.68,-.30,-.08))
                    /float3(.24,.15+tower*.09,.32)));
                shape = max(shape, 1-length((q-float3(.69,-.32,.06))
                    /float3(.25,.14+(1-tower)*.1,.33)));
                float detail = Noise(p*5.8+seed) * .65 + Noise(p*14.2+seed) * .35;
                return saturate(shape * 4.5 - .35 - detail * 1.35);
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
                float3 sun = normalize(mul((float3x3)unity_WorldToObject, normalize(float3(.6,1,.35))));
                float stepSize = (leave-entry)/28;
                float3 light = 0;
                float opacity = 0;
                [loop] for(int sampleIndex=0; sampleIndex<28; sampleIndex++)
                {
                    float3 p = origin + direction * (entry + (sampleIndex+.5)*stepSize);
                    float absorption = 1-exp(-Density(p,up)*stepSize*11);
                    float3 tint = lerp(_Bottom.rgb,_Top.rgb,smoothstep(-.65,.70,dot(p,up)));
                    tint *= .64 + .36*exp(-Density(p+sun*.22,up)*2.6);
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
