import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import OpenTimeForm from '../OpenTimeForm';

const useStyles = makeStyles({});

function StakeholderEdit(props) {
	const [ openTimes, setOpenTimes ] = useState('');

	return (
		<React.Fragment>
      <div>{openTimes}</div>
			<OpenTimeForm setOpenTimes={setOpenTimes}/>;
		</React.Fragment>
	);
}

export default StakeholderEdit;

