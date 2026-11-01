import * as THREE from "three";

export function installSceneShaders(benchmark, lowPower = false) {
  // Contact-hardening soft shadows (PCSS): crisp where a prop meets the surface, spreading wider
  // the further the shadow falls from it. Swapped in for three's fixed-width PCF soft filter, for
  // the sun, window and lamp and for the neons' point lights alike; each light's `shadow.radius`
  // is its widest blur, in texels.
  if (benchmark !== "no-pcss" && !THREE.ShaderChunk.shadowmap_pars_fragment.includes("pcssShadow")) {
    const search = lowPower ? 4 : 8;
    const samples = lowPower ? 6 : 24;
    // The Vogel disk never changes. Precompute it once instead of evaluating trig and square
    // roots for every tap, for every shadowed light, for every Retina fragment.
    const disk = (count) => Array.from({ length: count }, (_, i) => {
      const angle = i * 2.39996;
      const radius = Math.sqrt((i + 0.5) / count);
      return `vec2(${(Math.cos(angle) * radius).toFixed(8)}, ${(Math.sin(angle) * radius).toFixed(8)})`;
    });
    const pcss = `
      // a quick search for what's in the way, then a finer filter sized by how far it is
      // (fewer on phones, where the coarser grain hides in the smaller pixels; on a desktop
      // screen the wide, faint penumbrae on pale walls show grain below about two dozen)
      #define PCSS_SEARCH ${search}
      #define PCSS_SAMPLES ${samples}
      const vec2 PCSS_DISK[ ${search + samples} ] = vec2[]( ${[...disk(search), ...disk(samples)].join(", ")} );
      // Five taps across the widest blur first: all lit, or all blocked, means this pixel is
      // nowhere near a shadow's edge, and only the edges (a sliver of the screen) pay for the rest
      const vec2 PCSS_PROBES[ 4 ] = vec2[]( vec2( 1.0, 0.0 ), vec2( -1.0, 0.0 ), vec2( 0.0, 1.0 ), vec2( 0.0, -1.0 ) );
      // how far (in shadow-map depth) a shadow must fall before it's fully spread
      #define PCSS_RANGE 0.03
      // A Vogel disk: evenly spread samples, turned per pixel so the banding turns to fine grain
      vec2 pcssDisk( int i, int count, vec2 rotation ) {
        vec2 p = PCSS_DISK[ count == PCSS_SEARCH ? i : i + PCSS_SEARCH ];
        return vec2( p.x * rotation.x - p.y * rotation.y, p.x * rotation.y + p.y * rotation.x );
      }
      float pcssShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowRadius, vec4 coord ) {
        vec2 texel = 1.0 / shadowMapSize;
        float probe = texture2DCompare( shadowMap, coord.xy, coord.z );
        for ( int i = 0; i < 4; i ++ ) probe += texture2DCompare( shadowMap, coord.xy + PCSS_PROBES[ i ] * shadowRadius * texel, coord.z );
        if ( probe == 5.0 ) return 1.0;
        if ( probe == 0.0 ) return 0.0;
        float spin = rand( coord.xy ) * PI2;
        vec2 rotation = vec2( cos( spin ), sin( spin ) );
        float blockers = 0.0;
        float blockerDepth = 0.0;
        for ( int i = 0; i < PCSS_SEARCH; i ++ ) {
          float d = unpackRGBAToDepth( texture2D( shadowMap, coord.xy + pcssDisk( i, PCSS_SEARCH, rotation ) * shadowRadius * texel ) );
          if ( d < coord.z ) { blockers += 1.0; blockerDepth += d; }
        }
        if ( blockers == 0.0 ) return 1.0;
        float spread = smoothstep( 0.0, PCSS_RANGE, coord.z - blockerDepth / blockers );
        // Never narrower than a quarter of the widest blur: where a light rakes across a surface
        // (the window's light along the back wall) one texel stretches into a long step, and a
        // prop a hand's width off the wall would show those steps as a jagged staircase
        float radius = mix( max( 1.0, shadowRadius * 0.25 ), shadowRadius, spread );
        float lit = 0.0;
        for ( int i = 0; i < PCSS_SAMPLES; i ++ ) {
          lit += texture2DCompare( shadowMap, coord.xy + pcssDisk( i, PCSS_SAMPLES, rotation ) * radius * texel, coord.z );
        }
        return lit / float( PCSS_SAMPLES );
      }
    `;
    // Point lights store linear distance, so the penumbra follows the real PCSS ratio: fully
    // spread once the surface is twice as far from the light as the thing in the way
    const pcssPoint = `
      float pcssPointShadow( sampler2D shadowMap, float texelY, float shadowRadius, vec3 dir, float dp ) {
        vec3 side = normalize( cross( dir, abs( dir.y ) < 0.99 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 ) ) );
        vec3 up = cross( side, dir );
        float probe = texture2DCompare( shadowMap, cubeToUV( dir, texelY ), dp );
        for ( int i = 0; i < 4; i ++ ) {
          vec2 o = PCSS_PROBES[ i ] * shadowRadius * texelY;
          probe += texture2DCompare( shadowMap, cubeToUV( dir + side * o.x + up * o.y, texelY ), dp );
        }
        if ( probe == 5.0 ) return 1.0;
        if ( probe == 0.0 ) return 0.0;
        // Stable taps keep overlapping coloured point lights from turning shadow grain into coloured speckles.
        vec2 rotation = vec2( 1.0, 0.0 );
        float blockers = 0.0;
        float blockerDepth = 0.0;
        for ( int i = 0; i < PCSS_SEARCH; i ++ ) {
          vec2 o = pcssDisk( i, PCSS_SEARCH, rotation ) * shadowRadius * texelY;
          float d = unpackRGBAToDepth( texture2D( shadowMap, cubeToUV( dir + side * o.x + up * o.y, texelY ) ) );
          if ( d < dp ) { blockers += 1.0; blockerDepth += d; }
        }
        if ( blockers == 0.0 ) return 1.0;
        blockerDepth /= blockers;
        float spread = smoothstep( 0.0, 1.0, ( dp - blockerDepth ) / max( blockerDepth, 1e-3 ) );
        float radius = mix( max( 1.0, shadowRadius * 0.25 ), shadowRadius, spread ) * texelY;
        float lit = 0.0;
        for ( int i = 0; i < PCSS_SAMPLES; i ++ ) {
          vec2 o = pcssDisk( i, PCSS_SAMPLES, rotation ) * radius;
          lit += texture2DCompare( shadowMap, cubeToUV( dir + side * o.x + up * o.y, texelY ), dp );
        }
        return lit / float( PCSS_SAMPLES );
      }
    `;
    THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment
      .replace("float getShadow(", `${pcss}\n\tfloat getShadow(`)
      .replace("#elif defined( SHADOWMAP_TYPE_PCF_SOFT )", "#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\n\t\t\treturn pcssShadow( shadowMap, shadowMapSize, shadowRadius, shadowCoord );")
      .replace("float getPointShadow(", `${pcssPoint}\n\tfloat getPointShadow(`)
      .replace(
        "#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )",
        "#if defined( SHADOWMAP_TYPE_PCF_SOFT )\n\t\t\treturn pcssPointShadow( shadowMap, texelSize.y, shadowRadius, bd3D, dp );\n\t\t#elif defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_VSM )",
      );
  }

  // Toon bands that change colour, not just brightness, as a painter shades: the turned-away band
  // leans cool violet and the band at the turn, where light gives way to shade, runs a little
  // warm and saturated. Every toon material (the batched one too) picks it up, at the cost of a
  // multiply.
  if (benchmark !== "no-ramp" && !THREE.ShaderChunk.gradientmap_pars_fragment.includes("toonBand")) {
    THREE.ShaderChunk.gradientmap_pars_fragment = THREE.ShaderChunk.gradientmap_pars_fragment.replace(
      "return vec3( texture2D( gradientMap, coord ).r );",
      `float toonBand = texture2D( gradientMap, coord ).r;
  		vec3 tint = mix( vec3( 0.86, 0.9, 1.12 ), vec3( 1.08, 1.0, 0.92 ), smoothstep( 0.3, 0.6, toonBand ) );
  		tint = mix( tint, vec3( 1.0 ), smoothstep( 0.8, 1.0, toonBand ) );
  		return vec3( toonBand ) * tint;`,
    );
  }
}
