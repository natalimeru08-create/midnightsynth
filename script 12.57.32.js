"use strict";
      const $ = (id) => document.getElementById(id);
      const state = {
        playing: false,
        lead: "dark",
        bass: "hard",
        fx: { rumble: true, distortion: true, atmosphere: true, echo: false },
        drums: { kick: true, clap: true, hat: true, metal: false },
      };
      const colors = [
        "#1511B9",
        "#00FF08",
        "#00A1FF",
        "#DF0000",
        "#6100DF",
        "#FFD400",
      ];
      const stepSeconds = 60 / 128 / 4,
        notes = [
          0,
          0,
          null,
          0,
          0,
          null,
          -2,
          0,
          0,
          null,
          0,
          3,
          null,
          0,
          -2,
          0,
          -4,
          -4,
          null,
          -4,
          -2,
          null,
          0,
          -4,
          -2,
          null,
          -2,
          0,
          0,
          null,
          -2,
          0,
        ];
      let ac,
        master,
        analyser,
        bassBus,
        leadBus,
        drumBus,
        atmosBus,
        rumbleBus,
        distDry,
        distWet,
        delayWet,
        feedback,
        noiseBuffer;
      let timer = null,
        raf = null,
        nextTime = 0,
        step = 0,
        epoch = 0,
        visualTimers = [],
        sources = new Set(),
        colorIndex = 0;
      const pitch = (n) => 92.5 * Math.pow(2, n / 12);
      function waveCurve(amount) {
        const curve = new Float32Array(2048);
        for (let i = 0; i < curve.length; i++) {
          const x = (i * 2) / (curve.length - 1) - 1;
          curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
        }
        return curve;
      }
      function init() {
        if (ac) return;
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = 0.55;
        analyser = ac.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 5;
        comp.attack.value = 0.003;
        comp.release.value = 0.18;
        master.connect(comp);
        comp.connect(analyser);
        analyser.connect(ac.destination);
        bassBus = ac.createGain();
        leadBus = ac.createGain();
        drumBus = ac.createGain();
        atmosBus = ac.createGain();
        rumbleBus = ac.createGain();
        distDry = ac.createGain();
        distWet = ac.createGain();
        const shaper = ac.createWaveShaper();
        shaper.curve = waveCurve(3.4);
        shaper.oversample = "2x";
        bassBus.connect(distDry);
        distDry.connect(master);
        bassBus.connect(shaper);
        shaper.connect(distWet);
        distWet.connect(master);
        leadBus.connect(master);
        drumBus.connect(master);
        atmosBus.connect(master);
        rumbleBus.connect(master);
        const delay = ac.createDelay(1);
        delay.delayTime.value = (60 / 128) * 0.75;
        feedback = ac.createGain();
        feedback.gain.value = 0.22;
        delayWet = ac.createGain();
        leadBus.connect(delay);
        delay.connect(delayWet);
        delayWet.connect(master);
        delay.connect(feedback);
        feedback.connect(delay);
        noiseBuffer = ac.createBuffer(
          1,
          Math.floor(ac.sampleRate * 2),
          ac.sampleRate,
        );
        const d = noiseBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        updateGains();
      }
      function updateGains() {
        if (!ac) return;
        const t = ac.currentTime;
        bassBus.gain.setTargetAtTime(
          (+$("bassLevel").value / 100) * 0.57,
          t,
          0.02,
        );
        leadBus.gain.setTargetAtTime(
          (+$("leadLevel").value / 100) * 0.48,
          t,
          0.02,
        );
        drumBus.gain.setTargetAtTime(
          (+$("drumLevel").value / 100) * 0.74,
          t,
          0.02,
        );
        distDry.gain.setTargetAtTime(state.fx.distortion ? 0.55 : 1, t, 0.025);
        distWet.gain.setTargetAtTime(state.fx.distortion ? 0.34 : 0, t, 0.025);
        delayWet.gain.setTargetAtTime(state.fx.echo ? 0.2 : 0, t, 0.025);
        atmosBus.gain.setTargetAtTime(state.fx.atmosphere ? 0.09 : 0, t, 0.07);
        rumbleBus.gain.setTargetAtTime(state.fx.rumble ? 0.23 : 0, t, 0.035);
      }
      function track(s) {
        sources.add(s);
        s.onended = () => sources.delete(s);
        return s;
      }
      function oscillator(
        type,
        f,
        t,
        duration,
        destination,
        peak = 0.2,
        attack = 0.006,
      ) {
        const o = track(ac.createOscillator()),
          g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(
          Math.max(0.0002, peak),
          t + Math.min(attack, duration * 0.45),
        );
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        o.connect(g);
        g.connect(destination);
        o.start(t);
        o.stop(t + duration + 0.02);
        return o;
      }
      function noise(t, duration, destination, cutoff, volume) {
        const src = track(ac.createBufferSource()),
          f = ac.createBiquadFilter(),
          g = ac.createGain();
        src.buffer = noiseBuffer;
        f.type = "highpass";
        f.frequency.value = cutoff;
        g.gain.setValueAtTime(Math.max(0.0001, volume), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(f);
        f.connect(g);
        g.connect(destination);
        src.start(t);
        src.stop(t + duration + 0.005);
      }
      function bassHit(t, n) {
        const f = pitch(n),
          s = state.bass,
          duration = s === "deep" ? 0.28 : s === "hard" ? 0.15 : 0.19;
        const filter = ac.createBiquadFilter();
        filter.type = "lowpass";
        filter.Q.value = 0.7;
        const cutoff = s === "deep" ? 280 : s === "hard" ? 740 : 1400;
        filter.frequency.setValueAtTime(cutoff, t);
        filter.connect(bassBus);
        oscillator(
          s === "deep" ? "triangle" : "sawtooth",
          f,
          t,
          duration,
          filter,
          s === "deep" ? 0.31 : 0.24,
        );
        if (s === "hard") {
          const o = oscillator("square", f, t, 0.115, filter, 0.1);
          o.detune.value = 5;
        }
        if (s === "rave") {
          oscillator("square", f * 2, t, 0.13, filter, 0.075);
        }
        const subFilter = ac.createBiquadFilter();
        subFilter.type = "lowpass";
        subFilter.frequency.value = 120;
        subFilter.connect(master);
        oscillator("sine", f / 2, t, 0.23, subFilter, 0.09);
        visualAt(t, () => {
          document.body.style.backgroundColor =
            colors[colorIndex++ % colors.length];
        });
      }
      function kick(t) {
        const o = track(ac.createOscillator()),
          g = ac.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(155, t);
        o.frequency.exponentialRampToValueAtTime(44, t + 0.09);
        g.gain.setValueAtTime(0.73, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
        o.connect(g);
        g.connect(drumBus);
        o.start(t);
        o.stop(t + 0.28);
        if (state.fx.rumble) {
          const f = ac.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.value = 110;
          f.connect(rumbleBus);
          const r = oscillator("sine", 51, t + 0.045, 0.38, f, 0.25, 0.02);
          r.frequency.exponentialRampToValueAtTime(39, t + 0.37);
        }
      }
      function clap(t) {
        noise(t, 0.12, drumBus, 1200, 0.23);
      }
      function hat(t, open = false) {
        noise(t, open ? 0.14 : 0.045, drumBus, 6800, open ? 0.12 : 0.07);
      }
      function metal(t) {
        const f = ac.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 2600;
        f.Q.value = 4;
        f.connect(drumBus);
        oscillator("square", 390, t, 0.075, f, 0.055);
        oscillator("square", 579, t, 0.065, f, 0.03);
      }
      function leadHit(t, n) {
        const f = pitch(n + 24),
          s = state.lead;
        const filter = ac.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value =
          s === "dark" ? 850 : s === "club" ? 1900 : 3100;
        filter.connect(leadBus);
        oscillator(
          s === "dark" ? "triangle" : s === "club" ? "square" : "sawtooth",
          f,
          t,
          s === "dark" ? 0.22 : 0.12,
          filter,
          s === "rave" ? 0.15 : 0.13,
        );
      }

      function atmosphere(t) {
        const f = ac.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 240;
        f.connect(atmosBus);
        oscillator("sine", 55, t, 7.1, f, 0.3, 0.5);
        oscillator("triangle", 82.4, t, 7.1, f, 0.11, 0.6);
      }
      function schedule(t, i) {
        const p = i % 64,
          bar = Math.floor(p / 16),
          n = notes[Math.floor(p / 2)];
        if (p === 0 && state.fx.atmosphere) atmosphere(t);
        if (p % 4 === 0 && state.drums.kick) kick(t);
        if ((p % 16 === 4 || p % 16 === 12) && state.drums.clap) clap(t);
        if (p % 4 === 2 && state.drums.hat) hat(t, p % 16 === 14);
        if (p % 16 === 11 && state.drums.hat) hat(t);
        if (p % 16 === 10 && state.drums.metal) metal(t);
        if (p % 2 === 0 && n !== null) bassHit(t, n);
        if ([6, 22, 38, 54].includes(p)) leadHit(t, [0, 3, -4, 5][bar]);
      }
      function scheduler() {
        if (!state.playing) return;
        while (nextTime < ac.currentTime + 0.11) {
          schedule(nextTime, step);
          step = (step + 1) % 64;
          nextTime += stepSeconds;
        }
      }
      function visualAt(t, fn) {
        const e = epoch,
          id = setTimeout(
            () => {
              if (state.playing && e === epoch) fn();
            },
            Math.max(0, (t - ac.currentTime) * 1000),
          );
        visualTimers.push(id);
      }
      const bars = [...document.querySelectorAll(".bar")];
      function meter() {
        if (!state.playing) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        bars.forEach((b, i) => {
          let v = 0;
          for (let j = 0; j < 8; j++) v += data[i * 8 + j] || 0;
          b.style.height = 5 + Math.min(65, (v / 8 / 255) * 70) + "px";
        });
        raf = requestAnimationFrame(meter);
      }
      async function play() {
        init();
        if (state.playing) return;
        await ac.resume();
        epoch++;
        state.playing = true;
        document.body.classList.add("music-playing");
        step = 0;
        nextTime = ac.currentTime + 0.08;
        colorIndex = 0;
        $("play").classList.add("active");
        $("play").textContent = "PLAYING";
        $("status").textContent = "LIVE · EFFECTS READY";
        feedback.gain.setValueAtTime(0.22, ac.currentTime);
        updateGains();
        timer = setInterval(scheduler, 25);
        scheduler();
        meter();
      }
      function stop() {
        state.playing = false;
        document.body.classList.remove("music-playing");
        epoch++;
        clearInterval(timer);
        cancelAnimationFrame(raf);
        visualTimers.forEach(clearTimeout);
        visualTimers = [];
        sources.forEach((s) => {
          try {
            s.stop();
          } catch (e) {}
        });
        sources.clear();
        document.body.style.backgroundColor = colors[0];
        bars.forEach((b) => (b.style.height = "5px"));
        $("play").classList.remove("active");
        $("play").textContent = "PLAY";
        $("status").textContent = "READY";
        if (ac) {
          delayWet.gain.cancelScheduledValues(ac.currentTime);
          delayWet.gain.setValueAtTime(0, ac.currentTime);
          feedback.gain.setValueAtTime(0, ac.currentTime);
        }
      }
      document.querySelectorAll("[data-group]").forEach((group) =>
        group.querySelectorAll("button").forEach((btn) =>
          btn.addEventListener("click", () => {
            group
              .querySelectorAll("button")
              .forEach((b) => b.classList.toggle("active", b === btn));
            state[group.dataset.group] = btn.dataset.style;
          }),
        ),
      );
      document.querySelectorAll("[data-fx],[data-drum]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const category = btn.dataset.fx ? "fx" : "drums",
            key = btn.dataset.fx || btn.dataset.drum;
          state[category][key] = !state[category][key];
          const on = state[category][key];
          btn.classList.toggle("active", on);
          btn.setAttribute("aria-pressed", String(on));
          btn.querySelector("small").textContent = on ? "ON" : "OFF";
          updateGains();
        }),
      );
      ["lead", "bass", "drum"].forEach((n) =>
        $(n + "Level").addEventListener("input", () => {
          $(n + "Num").textContent = $(n + "Level").value;
          updateGains();
        }),
      );
      $("play").addEventListener("click", play);
      $("stop").addEventListener("click", stop);
      window.addEventListener("pagehide", stop);
