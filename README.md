Dattorro's Reverb Implemented in WebAudio AudioWorklet
=====

To see the demo, refer to project page above.

## Characteristics

* All paramters are k-rated.
* Accepts one input with two channels and 
* Returns one output with two channels.

## Usage

You can use this in your project like below. 

```javascript
yourAudioContext.addModule('dattorroReverb.js').then(() => {
	let reverb = new AudioWorkletNode(yourAudioContext, 'DattorroReverb');

	originNode.connect(reverb);
	reverb.connect(destinationNode);
});
```

## References

* Jon Dattorro's paper - [pdf](https://ccrma.stanford.edu/~dattorro/EffectDesignPart1.pdf)
* AudioWorklet spec - [link](https://webaudio.github.io/web-audio-api/#audioworklet)

## Other Works

Clips used in the demo page are from Kikuo's [Mikukikuo 5](https://kikuo.bandcamp.com/album/kikuo-miku-5) within tracks under CC BY-NC-SA.

## License
I release the source code within `index.html` and `dattorroReverb.js` under Public Domain.