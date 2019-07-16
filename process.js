class Process extends AudioWorkletProcessor {
	
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
				maxValue: 1,
				automationRate: "k-rate"
		},{
			 	name: 'decayDiffusion2',
				defaultValue: 0.5,
				minValue: 0,
				maxValue: 1,
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

		this.excursion	= 0;

		this._Delays	= [];

		this.makeDelay(1);

		// pre
		this.makeDelay(142); // 1
		this.makeDelay(107);
		this.makeDelay(379);
		this.makeDelay(277);

		// left tankie
		this.makeDelay(672); // 5
		this.makeDelay(4453);
		this.makeDelay(1);
		this.makeDelay(1800);
		this.makeDelay(3720);

		// right tankie
		this.makeDelay(908); // 10
		this.makeDelay(4217); // 11 (48-54)
		this.makeDelay(1);
		this.makeDelay(2656); // 13 (55-59)
		this.makeDelay(3163);

	}

	conv (numSamp) {
		return numSamp*sampleRate/29761;
	}

	makeDelay (length, noConversion) { 
		// length, data, write, read
		let len = noConversion? length : Math.round(this.conv(length));
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
		return this._Delays[index][1][(this._Delays[index][3] + ~~this.conv(i))%this._Delays[index][0]];
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
		let bw = paramters.bandwidth[0],
			fi = paramters.inputDiffusion1[0],
			si = paramters.inputDiffusion2[0],
			dc = paramters.decay[0],
			fd = paramters.decayDiffusion1[0],
			sd = paramters.decayDiffusion2[0],
			dp = paramters.damping[0],
			we = paramters.wet[0],
			dr = paramters.dry[0];

		let lOut	= outputs[0][0];
		let rOut	= outputs[0][1];

		let i = 0;
		while (i < 128) {
			let input	= (inputs[0][0][i] + inputs[0][1][i]) * 0.5; 
			let lo 		= 0.0;
			let ro 		= 0.0;

			this.writeDelay(0, input * bw + (1 - bw) * this.readDelay(0));

			// pre
			this.writeDelay(1, this.readDelay(0) - this.readDelay(1) * fi);
			this.writeDelay(2, fi * this.readPreDelay(1) + this.readDelay(1) - this.readDelay(2) * fi);
			this.writeDelay(3, fi * this.readPreDelay(2) + this.readDelay(2) - this.readDelay(3) * si);
			this.writeDelay(4, si * this.readPreDelay(3) + this.readDelay(3) - this.readDelay(4) * si);

			let leftTankie	= si * this.readPreDelay(4) + this.readDelay(4) + this.readDelay(14) * dc; 
			let rightTankie = si * this.readPreDelay(4) + this.readDelay(4) + this.readDelay(9) * dc; 

			// left
			this.writeDelay(5, leftTankie + this.readDelay(5) * fd);
			this.writeDelay(6, this.readDelay(5) - this.readPreDelay(5) * fd); // long delay
			this.writeDelay(7, (1 - dp) * this.readDelay(6) + dp * this.readDelay(7)) ; // damper
			this.writeDelay(8, dc * this.readDelay(7) - this.readDelay(8) * sd);
			this.writeDelay(9, this.readDelay(8) + this.readPreDelay(8) * sd); // long delay

			// right
			this.writeDelay(10, leftTankie + this.readDelay(10) * fd);
			this.writeDelay(11, this.readDelay(10) - this.readPreDelay(10) * fd); // long delay
			this.writeDelay(12, (1 - dp) * this.readDelay(11) + dp * this.readDelay(12)) ; // damper
			this.writeDelay(13, dc * this.readDelay(12) - this.readDelay(13) * sd);
			this.writeDelay(14, this.readDelay(13) + this.readPreDelay(13) * sd); // long delay

			lo =  0.6 * this.readDelayAt(11, 266);
			lo += 0.6 * this.readDelayAt(11, 2974);
			lo -= 0.6 * this.readDelayAt(13, 1913);
			lo += 0.6 * this.readDelayAt(14, 1996);
			lo -= 0.6 * this.readDelayAt(5, 1990);
			lo -= 0.6 * this.readDelayAt(8, 187);
			lo -= 0.6 * this.readDelayAt(9, 1066);

			ro =  0.6 * this.readDelayAt(6, 353);
			ro += 0.6 * this.readDelayAt(6, 3627);
			ro -= 0.6 * this.readDelayAt(8, 1228);
			ro += 0.6 * this.readDelayAt(9, 2673);
			ro -= 0.6 * this.readDelayAt(11, 2111);
			ro -= 0.6 * this.readDelayAt(13, 335);
			ro -= 0.6 * this.readDelayAt(14, 121);

			// write
			lOut[i] = inputs[0][0][i] * dr + lo * we;
			rOut[i] = inputs[0][1][i] * dr + ro * we;

			i++;

			this.updateDelays();
		}

		return true;
	}

}

registerProcessor('process', Process);