(function () {
  'use strict';

  const vertex = `
    precision mediump float;
    attribute vec3 aParam;
    uniform vec2 uViewport;
    uniform vec3 uRotation;
    uniform float uForm, uKind, uZoom, uOrbit;
    varying vec3 vNormal, vPosition, vParam;

    const float TAU = 6.2831853;

    mat3 turnX(float a) {
      float c = cos(a), s = sin(a);
      return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);
    }
    mat3 turnY(float a) {
      float c = cos(a), s = sin(a);
      return mat3(c,0.,-s, 0.,1.,0., s,0.,c);
    }
    mat3 turnZ(float a) {
      float c = cos(a), s = sin(a);
      return mat3(c,s,0., -s,c,0., 0.,0.,1.);
    }

    vec3 center(float u, float strand) {
      float phase = strand * TAU / 3.;
      if (uKind > .5) {
        vec3 ring = vec3(1.92 * cos(u), 1.92 * sin(u), 0.);
        return turnZ(uOrbit * .86 + .16) * turnX(1.05 + uOrbit * .21) * ring;
      }
      float turn = 3. * u + phase;
      float radius = 1.16 + .35 * cos(turn);
      vec3 braid = vec3(radius * cos(u), radius * sin(u), .36 * sin(turn));
      float wave = 2. * u + phase;
      vec3 ribbon = vec3(1.64 * cos(u), (.72 + .24 * cos(wave)) * sin(u) + .26 * sin(wave), .51 * cos(wave));
      vec3 loop = vec3(1.19 * cos(u), 1.19 * sin(u), .37 * (strand - 1.));
      loop = turnX(.37 * (strand - 1.)) * loop;
      vec3 form = mix(braid, ribbon, smoothstep(0., 1., uForm));
      return mix(form, loop, smoothstep(1., 2., uForm));
    }

    void main() {
      float u = aParam.x * TAU;
      float v = aParam.y * TAU;
      float strand = aParam.z;
      vec3 c = center(u, strand);
      vec3 tangent = normalize(center(u + .004, strand) - center(u - .004, strand));
      vec3 normal = normalize(cross(tangent, vec3(0., 0., 1.)));
      vec3 binormal = normalize(cross(tangent, normal));
      vec3 radial = normal * cos(v) + binormal * sin(v);
      float thick = .112 + .026 * sin(2. * u + strand * 2.);
      if (uKind > .5) thick = .006 + .003 * step(1., uOrbit);
      mat3 spin = turnZ(uRotation.z) * turnY(uRotation.y) * turnX(uRotation.x);
      vec3 pos = spin * (c + radial * thick);
      vPosition = pos;
      vNormal = spin * radial;
      vParam = aParam;
      float d = 5.05 - pos.z;
      float scale = 2.55 * uZoom * min(1., uViewport.x / uViewport.y);
      gl_Position = vec4(pos.x * scale * uViewport.y / uViewport.x, pos.y * scale, d * 1.045 - .65, d);
    }
  `;

  const fragment = `
    precision mediump float;
    uniform vec3 uTint;
    uniform float uKind, uOrbit;
    varying vec3 vNormal, vPosition, vParam;
    void main() {
      if (uKind > .5) {
        float dash = step(.56, fract(vParam.x * (uOrbit > 1. ? 74. : 19.)));
        float front = smoothstep(-1.1, 1.1, vPosition.z);
        gl_FragColor = vec4(mix(uTint * .55, uTint, front), (.19 + front * .45) * (uOrbit > 1. ? dash : 1.));
        return;
      }
      vec3 n = normalize(vNormal);
      vec3 view = normalize(vec3(0., 0., 5.05) - vPosition);
      vec3 light = normalize(vec3(-.69, .87, 1.));
      vec3 fill = normalize(vec3(.64, -.29, -.79));
      float key = max(0., dot(n, light));
      float bounce = max(0., dot(n, fill));
      float rim = pow(1. - max(0., dot(n, view)), 2.9);
      float spec = pow(max(0., dot(n, normalize(light + view))), 21.);
      float ribs = pow(.5 + .5 * cos(6.28318 * (vParam.x * 136. + .28 * sin(vParam.y * 6.28318))), 5.);
      float grain = .992 + .012 * sin(vParam.x * 792. + sin(vParam.y * 74.));
      float strand = .79 + .16 * vParam.z;
      vec3 metal = mix(uTint * strand, uTint.bgr * .68, .16 * (2. - vParam.z));
      vec3 shade = metal * (.19 + .65 * key + .21 * bounce) * (.81 + ribs * .33) * grain;
      shade += vec3(.88, .94, .68) * (.48 * spec + .20 * rim + .058 * ribs * key);
      gl_FragColor = vec4(shade, 1.);
    }
  `;

  function makeProgram(gl) {
    function shader(type, code) {
      const handle = gl.createShader(type);
      gl.shaderSource(handle, code);
      gl.compileShader(handle);
      if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(handle));
      }
      return handle;
    }
    const program = gl.createProgram();
    const v = shader(gl.VERTEX_SHADER, vertex);
    const f = shader(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function tubeMesh() {
    const length = 288;
    const sides = 20;
    const vertices = [];
    const elements = [];
    for (let strand = 0; strand < 3; strand += 1) {
      const offset = vertices.length / 3;
      for (let u = 0; u <= length; u += 1) {
        for (let v = 0; v <= sides; v += 1) {
          vertices.push(u / length, v / sides, strand);
          if (u === length || v === sides) continue;
          const a = offset + u * (sides + 1) + v;
          const b = a + sides + 1;
          elements.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    return {
      vertices: new Float32Array(vertices),
      elements: new Uint16Array(elements),
      strandSize: length * sides * 6
    };
  }

  const mesh = tubeMesh();
  window.makeSculpture = function makeSculpture(canvas) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return null;

    let program;
    try {
      program = makeProgram(gl);
    } catch (error) {
      console.warn('Using a static sculpture.', error.message);
      return null;
    }
    gl.useProgram(program);

    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    const param = gl.getAttribLocation(program, 'aParam');
    gl.enableVertexAttribArray(param);
    gl.vertexAttribPointer(param, 3, gl.FLOAT, false, 0, 0);

    const elements = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.elements, gl.STATIC_DRAW);

    const uniforms = Object.fromEntries(
      ['Viewport', 'Rotation', 'Form', 'Kind', 'Zoom', 'Orbit', 'Tint'].map(name => [name, gl.getUniformLocation(program, 'u' + name)])
    );
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    const stage = canvas.parentElement;
    stage.classList.add('webgl-ready');
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      stage.classList.remove('webgl-ready');
    });

    return {
      render({ form, rotation, color, zoom }) {
        if (gl.isContextLost()) return;
        const ratio = Math.min(1.55, devicePixelRatio || 1);
        const width = Math.round(canvas.clientWidth * ratio);
        const height = Math.round(canvas.clientHeight * ratio);
        if (!width || !height) return;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform2f(uniforms.Viewport, width, height);
        gl.uniform3fv(uniforms.Rotation, rotation);
        gl.uniform3fv(uniforms.Tint, color);
        gl.uniform1f(uniforms.Form, form);
        gl.uniform1f(uniforms.Zoom, zoom);
        gl.uniform1f(uniforms.Kind, 0);
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.drawElements(gl.TRIANGLES, mesh.elements.length, gl.UNSIGNED_SHORT, 0);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniform1f(uniforms.Kind, 1);
        for (const orbit of [0, 1.65]) {
          gl.uniform1f(uniforms.Orbit, orbit);
          gl.drawElements(gl.TRIANGLES, mesh.strandSize, gl.UNSIGNED_SHORT, 0);
        }
        gl.depthMask(true);
      }
    };
  };
}());
