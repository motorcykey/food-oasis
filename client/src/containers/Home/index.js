import React from 'react';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import SearchIcon from '@material-ui/icons/Search';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import Autocomplete from '@material-ui/lab/Autocomplete';
import LocationOnIcon from '@material-ui/icons/LocationOn';

const useStyles = makeStyles((theme) => ({
  paper: {
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(3),
  },
  header: {
    marginBottom: theme.spacing(1),
  },
  subtitle: {
    marginBottom: theme.spacing(3),
  },
  label: {
    fontWeight: 600,
  },
  form: {
    width: '100%',
    marginTop: theme.spacing(1),
  },
  address: {
    marginTop: theme.spacing(1),
    paddingRight: 0,
  },
  inputRoot: {
    '&[class*="MuiOutlinedInput-root"]': {
      paddingRight: 0,
    },
  },
  endAdornment: {
    display: 'none',
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
}));


const Home = () => {
  const classes = useStyles();

  const handleInputChange = (event, value, reason) => {
    console.log(
      'event: object, value: string, reason: string',
      event,
      value,
      reason,
    );
    if (reason === 'reset') {
      
    }

  }

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <Paper className={classes.paper}>
        <Typography component="h1" variant="h5" className={classes.header}>
          Welcome to Food Oasis
        </Typography>
        <Typography variant="caption" className={classes.subtitle}>
          Some cool interesting tag line for Food Oasis
        </Typography>
        <form className={classes.form} noValidate>
          <Typography className={classes.label}>
            What can we help you find?
          </Typography>
          <Autocomplete
            freeSolo
            classes={{
              root: classes.inputRoot,
              inputRoot: classes.inputRoot,
              endAdornment: classes.endAdornment,
            }}
            options={[{ title: 'Current Location' }]}
            getOptionLabel={(option) => option.title}
            onInputChange={handleInputChange}
            renderInput={(params) => (
              <TextField
                {...params}
                className={classes.address}
                variant="outlined"
                margin="normal"
                required
                fullWidth
                placeholder="Enter an address, neighborhood, ZIP"
                name="address"
                autoFocus
              />
            )}
            renderOption={(option, { selected }) => (
              <React.Fragment>
                <LocationOnIcon />
                {option.title}
              </React.Fragment>
            )}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            className={classes.submit}
            startIcon={<SearchIcon />}
          >
            Find Food
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default Home;
