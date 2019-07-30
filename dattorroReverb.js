class DattorroReverb extends AudioWorkletProcessor {
	
	static get parameterDescriptors() {
		return [{
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
			 	name: 'excursion',
				defaultValue: 0,
				minValue: 0,
				maxValue: 16,
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

		// this.excursion  = 16;

		this._Delays    = [];
		this._lp1       = 0.0;
		this._lp2       = 0.0;
		this._lp3       = 0.0;

		// pre
		this.makeDelay(0.004771345); 
		this.makeDelay(0.003595309);
		this.makeDelay(0.012734787);
		this.makeDelay(0.009307483);

		// left 
		this.makeDelay(0.022579886); 
		this.makeDelay(0.149625349);
		this.makeDelay(0.060481839);
		this.makeDelay(0.1249958  );

		// right 
		this.makeDelay(0.030509727); 
		this.makeDelay(0.141695508);
		this.makeDelay(0.089244313);
		this.makeDelay(0.106280031);

		this._taps = Int16Array.from([
			0.008937872,0.099929438,0.064278754,0.067067639,0.066866033,0.006283391,0.035818689,
			0.011861161,0.121870905,0.041262054,0.08981553 ,0.070931756,0.011256342,0.004065724
		], x => Math.round(this.conv(x)));

	}

	conv (value) {
		return value*sampleRate;
	}

	makeDelay (length, noConversion) { 
		// len, delay, write, read
		let len = Math.round(this.conv(length));
		this._Delays.push([
			len,
			new Float32Array(len),
			len - 1,
			0,
		]);
	}

	writeDelay (index, data) {
		this._Delays[index][1][this._Delays[index][2]] = data;
	}

	readDelay (index) {
		return this._Delays[index][1][this._Delays[index][3]];
	}

	readDelayAt (index, i) {
		return this._Delays[index][1][(this._Delays[index][3] + i)%this._Delays[index][0]];
	}

	readPreDelay (index) {
		return this._Delays[index][1][this._Delays[index][2]];
	}

	updateDelays () {
		for (let i = 0; i < this._Delays.length; i++) {
			this._Delays[i][2]++;
			this._Delays[i][3]++;
			this._Delays[i][2] %= this._Delays[i][0];
			this._Delays[i][3] %= this._Delays[i][0];
		}
	}

	// Only accepts one input, two channels.
	// Spits one output, two channels.
	process (inputs, outputs, paramters) {
		let bw = paramters.bandwidth[0]           ,
			fi = paramters.inputDiffusion1[0]     , 
			si = paramters.inputDiffusion2[0]     ,
			dc = paramters.decay[0]               ,
			ft = paramters.decayDiffusion1[0]     ,
			st = paramters.decayDiffusion2[0]     ,
			dp = paramters.damping[0]             ,
			we = paramters.wet[0]            * 0.6, // lo and ro are both multiplied by 0.6 anyways
			dr = paramters.dry[0]                 ;

		let lOut	= outputs[0][0];
		let rOut	= outputs[0][1];

		let i = 0;
		while (i < 128) {
			let lo = 0.0;
			let ro = 0.0;

			this._lp1        = (inputs[0][0][i] + inputs[0][1][i]) * 0.5 * bw + (1 - bw) * this._lp1;

			// Please note: The groupings and formatting below does not bare any useful information about 
			//              the topology of the network. I just want orderly looking text.

			// pre
			this.writeDelay(0,                              this._lp1          - fi * this.readDelay(0)    );
			this.writeDelay(1, fi * (this.readPreDelay(0) - this.readDelay(1)) +      this.readDelay(0)    );
			this.writeDelay(2, fi *  this.readPreDelay(1) + this.readDelay(1)  - si * this.readDelay(2)    );
			this.writeDelay(3, si * (this.readPreDelay(2) - this.readDelay(3)) +      this.readDelay(2)    );

			let split       =  si *  this.readPreDelay(3) + this.readDelay(3);

			// left
			this.writeDelay( 4, split +       dc * this.readDelay(11)          + ft * this.readDelay(4)    ); // tank diffuse 1
			this.writeDelay( 5,                    this.readDelay(4)           - ft * this.readPreDelay(4) ); // long delay 1
			this._lp2        =          (1 - dp) * this.readDelay(5)           + dp * this._lp2             ; // damp 1
			this.writeDelay( 6,               dc * this._lp2                   - st * this.readDelay(6)    ); // tank diffuse 2
			this.writeDelay( 7,                    this.readDelay(6)           + st * this.readPreDelay(6) ); // long delay 2

			// right
			this.writeDelay( 8, split +       dc * this.readDelay(7)           + ft * this.readDelay(8)     ); // tank diffuse 3
			this.writeDelay( 9,                    this.readDelay(8)           - ft * this.readPreDelay(8)  ); // long delay 3
			this._lp3        =          (1 - dp) * this.readDelay(9)           + dp * this._lp3              ; // damper 2
			this.writeDelay(10,               dc * this._lp3                   - st * this.readDelay(10)    ); // tank diffuse 4
			this.writeDelay(11,                    this.readDelay(10)          + st * this.readPreDelay(10) ); // long delay 4

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

			// write
			lOut[i] = inputs[0][0][i] * dr + lo * we;
			rOut[i] = inputs[0][1][i] * dr + ro * we;

			i++;

			this.updateDelays();
		}

		return true;
	}
}

registerProcessor('DattorroReverb', DattorroReverb);