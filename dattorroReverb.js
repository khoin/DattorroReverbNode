/*
In jurisdictions that recognize copyright laws, this software is to
be released into the public domain.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
THE AUTHOR(S) SHALL NOT BE LIABLE FOR ANYTHING, ARISING FROM, OR IN
CONNECTION WITH THE SOFTWARE OR THE DISTRIBUTION OF THE SOFTWARE.
*/

class DattorroReverb extends AudioWorkletProcessor {
	
	static get parameterDescriptors() {
		return [{
				name: 'preDelay',
				defaultValue: 0,
				minValue: 0,
				maxValue: sampleRate-1,
				automationRate: "k-rate"
		},{
				name: 'bandwidth',
				defaultValue: 0.9999,
				minValue: 0,
				maxValue: 1,
				automationRate: "k-rate"
		},{
				name: 'inputDiffusion1',
				defaultValue: 0.75,
				minValue: 0,
				maxValue: 1,
				automationRate: "k-rate"
		},{
				name: 'inputDiffusion2',
				defaultValue: 0.625,
				minValue: 0,
				maxValue: 1,
				automationRate: "k-rate"
		},{
				name: 'decay',
				defaultValue: 0.5,
				minValue: 0,
				maxValue: 1,
				automationRate: "k-rate"
		},{
				name: 'decayDiffusion1',
				defaultValue: 0.7,
				minValue: 0,
				maxValue: 0.999999,
				automationRate: "k-rate"
		},{
				name: 'decayDiffusion2',
				defaultValue: 0.5,
				minValue: 0,
				maxValue: 0.999999,
				automationRate: "k-rate"
		},{
				name: 'damping',
				defaultValue: 0.005,
				minValue: 0,
				maxValue: 1,
				automationRate: "k-rate"
		},{
				name: 'excursionRate', // in Hertz
				defaultValue: 0.5,
				minValue: 0,
				maxValue: 2,
				automationRate: "k-rate"
		},{
				name: 'excursionDepth', // milliseconds
				defaultValue: 0.7,
				minValue: 0,
				maxValue: 2,
				automationRate: "k-rate"
		},{
				name: 'wet',
				defaultValue: 0.3,
				minValue: 0,
				maxValue: 1,
				automationRate: "k-rate"
		},{
				name: 'dry',
				defaultValue: 0.6,
				minValue: 0,
				maxValue: 1,
				automationRate: "k-rate"
		}]
	}

	constructor(options) {
		super(options); 

		this._Delays    = [];
		this._pDLength  = sampleRate + (128 - sampleRate%128); // Pre-delay is always one-second long, rounded to the nearest 128-chunk
		this._preDelay  = new Float32Array(this._pDLength);
		this._pDWrite   = 0;
		this._lp1       = 0.0;
		this._lp2       = 0.0;
		this._lp3       = 0.0;
		this._excPhase	= 0.0;

		[
			0.004771345, 0.003595309, 0.012734787, 0.009307483, 
			0.022579886, 0.149625349, 0.060481839, 0.1249958  , 
			0.030509727, 0.141695508, 0.089244313, 0.106280031
		].forEach(x => this.makeDelay(x));

		this._taps = Int16Array.from([
			0.008937872, 0.099929438, 0.064278754, 0.067067639, 0.066866033, 0.006283391, 0.035818689, 
			0.011861161, 0.121870905, 0.041262054, 0.08981553 , 0.070931756, 0.011256342, 0.004065724
		], x => Math.round(x * sampleRate));
	}

	makeDelay(length) { 
		// len, array, write, read, mask
		let len = Math.round(length * sampleRate);
		let nextPow2 = 2**Math.ceil(Math.log2((len)));
		this._Delays.push([
			nextPow2,
			new Float32Array(nextPow2),
			len - 1,
			0|0,
			nextPow2 - 1
		]);
	}

	writeDelay(index, data) {
		this._Delays[index][1][this._Delays[index][2]] = data;
	}

	readDelay(index) {
		return this._Delays[index][1][this._Delays[index][3]];
	}

	readDelayAt(index, i) {
		return this._Delays[index][1][(this._Delays[index][3] + i)&this._Delays[index][4]];
	}

	// cubic interpolation
	// O. Niemitalo: https://www.musicdsp.org/en/latest/Other/49-cubic-interpollation.html
	readDelayCAt(index, i) { 
		let d = this._Delays[index],
			frac = i-~~i,
			int  = ~~i + d[3] - 1,
			mask = d[4];

		let x0 = d[1][int++ & mask],
			x1 = d[1][int++ & mask],
			x2 = d[1][int++ & mask],
			x3 = d[1][int   & mask];

		let a  = (3*(x1-x2) - x0 + x3) / 2,
			b  = 2*x2 + x0 - (5*x1+x3) / 2,
			c  = (x2-x0) / 2;

		return (((a * frac) + b) * frac + c) * frac + x1;
	}

	readPreDelay(index) {
		return this._Delays[index][1][this._Delays[index][2]];
	}

	// Only accepts one input, two channels.
	// Spits one output, two channels.
	process(inputs, outputs, parameters) {
		const 	pd   = ~~parameters.preDelay[0]          ,
				bw   = parameters.bandwidth[0]           ,
				fi   = parameters.inputDiffusion1[0]     , 
				si   = parameters.inputDiffusion2[0]     ,
				dc   = parameters.decay[0]               ,
				ft   = parameters.decayDiffusion1[0]     ,
				st   = parameters.decayDiffusion2[0]     ,
				dp   = parameters.damping[0]             ,
				ex   = parameters.excursionRate[0]   / sampleRate        ,
				ed 	 = parameters.excursionDepth[0]  * sampleRate /1000  ,
				we   = parameters.wet[0]             * 0.6               , // lo & ro both mult. by 0.6 anyways
				dr   = parameters.dry[0]                 ;

		const 	lOut = outputs[0][0],
				rOut = outputs[0][1];

		// write to predelay and dry output
		if (inputs[0].length == 2) {
			for (let i = 127; i >= 0; i--) {
				this._preDelay[this._pDWrite+i] = (inputs[0][0][i] + inputs[0][1][i]) * 0.5;

				outputs[0][0][i] = inputs[0][0][i]*dr;
				outputs[0][1][i] = inputs[0][1][i]*dr;
			}
		} else if (inputs[0].length > 0) {
			this._preDelay.set(
				inputs[0][0],
				this._pDWrite
			);
			for (let i = 127; i >= 0; i--) 
				outputs[0][0][i] = outputs[0][1][i] = inputs[0][0][i]*dr;
		} else {
			this._preDelay.set(
				new Float32Array(128),
				this._pDWrite
			);
		}

		let i = 0|0;
		while (i < 128) {
			let lo = 0.0,
				ro = 0.0;

			this._lp1        = this._preDelay[(this._pDLength + this._pDWrite - pd + i)%this._pDLength] * bw + (1 - bw) * this._lp1;

			// pre
			this.writeDelay(0,                              this._lp1          - fi * this.readDelay(0) );
			this.writeDelay(1, fi * (this.readPreDelay(0) - this.readDelay(1)) +      this.readDelay(0) );
			this.writeDelay(2, fi *  this.readPreDelay(1) + this.readDelay(1)  - si * this.readDelay(2) );
			this.writeDelay(3, si * (this.readPreDelay(2) - this.readDelay(3)) +      this.readDelay(2) );

			let split       =  si *  this.readPreDelay(3) + this.readDelay(3);

			let excursion   =  ed * (1 + Math.cos(this._excPhase*6.2800)); 
			let excursion2  =  ed * (1 + Math.sin(this._excPhase*6.2847)); 
			this._excPhase  += ex;

			// left loop
			this.writeDelay( 4, split +     dc * this.readDelay(11)               + ft * this.readDelayCAt(4, excursion) ); // tank diffuse 1
			this.writeDelay( 5,                  this.readDelayCAt(4, excursion)  - ft * this.readPreDelay(4)            ); // long delay 1
			this._lp2        =        (1 - dp) * this.readDelay(5)                + dp * this._lp2                        ; // damp 1
			this.writeDelay( 6,             dc * this._lp2                        - st * this.readDelay(6)               ); // tank diffuse 2
			this.writeDelay( 7,                  this.readDelay(6)                + st * this.readPreDelay(6)            ); // long delay 2

			// right loop 
			this.writeDelay( 8, split +     dc * this.readDelay(7)                + ft * this.readDelayCAt(8, excursion2)); // tank diffuse 3
			this.writeDelay( 9,                  this.readDelayCAt(8, excursion2) - ft * this.readPreDelay(8)            ); // long delay 3
			this._lp3        =        (1 - dp) * this.readDelay(9)                + dp * this._lp3                        ; // damper 2
			this.writeDelay(10,             dc * this._lp3                        - st * this.readDelay(10)              ); // tank diffuse 4
			this.writeDelay(11,                  this.readDelay(10)               + st * this.readPreDelay(10)           ); // long delay 4

			lo =  this.readDelayAt( 9, this._taps[0])
				+ this.readDelayAt( 9, this._taps[1])
				- this.readDelayAt(10, this._taps[2])
				+ this.readDelayAt(11, this._taps[3])
				- this.readDelayAt( 5, this._taps[4])
				- this.readDelayAt( 6, this._taps[5])
				- this.readDelayAt( 7, this._taps[6]);

			ro =  this.readDelayAt( 5, this._taps[7])
				+ this.readDelayAt( 5, this._taps[8])
				- this.readDelayAt( 6, this._taps[9])
				+ this.readDelayAt( 7, this._taps[10])
				- this.readDelayAt( 9, this._taps[11])
				- this.readDelayAt(10, this._taps[12])
				- this.readDelayAt(11, this._taps[13]);

			lOut[i] += lo * we;
			rOut[i] += ro * we;			

			i++;

			for (let j = 0; j < this._Delays.length; j++) {
				let d = this._Delays[j];
				d[2] = (d[2] + 1) & d[4];
				d[3] = (d[3] + 1) & d[4]; 
			}
		}

		// Update preDelay index
		this._pDWrite = (this._pDWrite + 128) % this._pDLength;

		return true;
	}
}

registerProcessor('DattorroReverb', DattorroReverb);