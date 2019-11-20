import React, { useState, useEffect } from 'react';
import OpenTimeInputs from './OpenTimeInput';
import Button from '@material-ui/core/Button';
// import TextField from '@material-ui/core/TextField';
// import { makeStyles } from 'material-ui/core/styles';

// const useStyles = makeStyles({

// })

function OpenTimeForm(props) {
	const [ inputs, setInputs ] = useState([ { days: '', openTime: '', closeTime: '' } ]);

	useEffect(
		() => {
			let hoursString = '';
			for (let i = 0; i < inputs.length; i++) {
				const { days, openTime, closeTime } = inputs[i];
				hoursString += days + openTime + closeTime;
			}
			props.setOpenTimes(hoursString);
			console.log('props???', props);
		},
		[ inputs ]
	);

	const addInput = () => {
		let newList = [ ...inputs, { days: '', openTime: '', closeTime: '' } ];
		setInputs(newList);
	};

	const inputsMap = inputs.map((val, i) => {
		let stateChange = (value, name) => {
			let newList = [ ...inputs ];
			newList[i][name] = value;
			setInputs(newList);
		};
		return (
			<div>
				input {i}
				<OpenTimeInputs values={val} stateChange={stateChange} />
			</div>
		);
	});
	return (
		<div>
			<div>{inputsMap}</div>
			<Button onClick={addInput}>Add Another Time</Button>
		</div>
	);
}

export default OpenTimeForm;
