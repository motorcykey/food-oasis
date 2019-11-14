import React, { useState, useEffect } from 'react'
import TextField from '@material-ui/core/TextField'

function OpenTimeInput(props) {
    const stop = e => {
        e.stopPropagation()
    }
    return (<React.Fragment>
        <TextField onChange={e=>props.stateChange(e.target.value, 'days')} onClick={stop} value={props.values.days} />
        <TextField onChange={e=>props.stateChange(e.target.value, 'openTime')}  onClick={stop} value={props.values.openTime} />
        <TextField onChange={e=>props.stateChange(e.target.value, 'closeTime')}  onClick={stop} value={props.values.closeTime} />

    </React.Fragment>)

}

export default OpenTimeInput