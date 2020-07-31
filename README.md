Dattorro's Reverb Implemented in WebAudio AudioWorklet, in Javascript
=====

To see the demo, refer to project page above.

## Characteristics

* All parameters are k-rated.
* Accepts one input with two channels and 
* Returns one output with two channels.

## Usage

You can use this in your project like so: 

```javascript
yourAudioContext.addModule('dattorroReverb.js').then(() => {
	let reverb = new AudioWorkletNode(aC, 'DattorroReverb', { outputChannelCount: [2] });

	originNode.connect(reverb);
	reverb.connect(destinationNode);
});
```

## Personal Considerations

Here I address the considerations I made that was not explicitly specified in the Dattorro paper.

### Interpolation of Delay Lines

**Quote:** "Linear interpolation, or better yet, all-pass interpolation can be efficiently employed [to ...] the two indicated delay lines [...]" (1.3.7, p. 665)

**Decision:** Cubic Interpolation. This is costly, but it is not used a lot.

### Note on Excursion

I've decided to implement it so that it is samplerate-independent. This means that the consideration below is voided. 

### 32 Sample Max Excursion

**Quote:** "at a peak excursion of about 8 samples for a sample rate of about 29.8 kHz." (footnote 14, p. 665) and "EXCURSION = 16 (Maximum peak sample excursion of delay modulation)" (Table 1, p. 663)

**Decision:** 32 samples for maximum excursion was chosen.

**Rationale:** At first, the two quotations appear contradictory. However, I believe Dattorro meant 16 samples for the _range_ of excursion and 8 samples for the peak.

### Unipolar Excursion

**Quote:** [no quotation available]

**Decision:** Delay length including excursion is: `length - e_depth + e_depth * excursion(t)` instead of `length + e_depth * excursion(t)`

**Rationale:** Because of the way the delay lines are implemented, excursions are not oscillating around original delay length, but the delays are contracting by twice the length from center to peak of the original excursion.

### Parameterized Decay Diffusion 2

**Quote:** "decay diffusion 2 = decay + 0.15, floor = 0.25, ceiling = 0.5" (Table 1, p. 663)

**Decision:** Clipping the parameter were not implemented, nor was it bounded to being `decay + 0.15`

**Rationale:** Elsewhere on top of page 664, the phrase "labeled by the knobs "decay diffusion 1" and "decay diffusion 2"" appears to me that they are meant to be controllable knobs and the quotation in Table 1 is merely a suggestion of what the value should be according to the `decay`. From the user experience standpoint, the two decay diffusions need not be exposed to the users. However, I am sticking to the paper on this issue.

### PreDelay length

**Quote:** Figure 1 of the paper

**Decision:** Max Predelay length is the sampling rate minus 1 (i.e., ~ 1 second).

**Rationale:** No rationale here, although 1 second is ridiculously long.

## Open Questions

### Parameterizing the decayRate as T60.

Currently, the `decayRate` parameter is a number which the signal in the tank will be (twice) scaled by. What is the [T60](https://ccrma.stanford.edu/~jos/mdft/Audio_Decay_Time_T60.html) of this reverb with respect to the `decayRate`?

## References

* Jon Dattorro's paper - [pdf](https://ccrma.stanford.edu/~dattorro/EffectDesignPart1.pdf)
* AudioWorklet spec - [link](https://webaudio.github.io/web-audio-api/#audioworklet)

## Other Works

* Clips from Kikuo's [Mikukikuo 5](https://kikuo.bandcamp.com/album/kikuo-miku-5) under CC BY-NC-SA.
* Guitar from user Placeboing on [Freesound](https://freesound.org/people/placeboing/sounds/338387/) under CC 0.

## License
For the two files `index.html` and `dattorroReverb.js`, refer to [LICENSE](LICENSE) - Public Domain + No-Liability.
