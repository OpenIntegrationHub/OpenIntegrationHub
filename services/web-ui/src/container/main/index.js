import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import flow from 'lodash/flow';
import { Route, Switch, withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
// Ui
import { withStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import CssBaseline from '@material-ui/core/CssBaseline';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import List from '@material-ui/core/List';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import NativeSelect from '@material-ui/core/NativeSelect';
import Grid from '@material-ui/core/Grid';
import {
    LockOpen, Business, Waves, Home as HomeIcon, AccessibleForward,
} from '@material-ui/icons';

// Actions & Components

import { logout } from '../../action/auth';
import { getUsers } from '../../action/users';
import Home from '../../component/home';
import Users from '../../component/users';
import Tenants from '../../component/tenants';
import Flows from '../../component/flows';
import Components from '../../component/components';

const drawerWidth = 240;

const styles = theme => ({
    root: {
        display: 'flex',
    },
    appBar: {
        position: 'inherit',
        backgroundImage: 'linear-gradient(73deg, #ff8200, #ff2473)',
        transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
    },
    appBarShift: {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: drawerWidth,
        transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
    },
    menuButton: {
        marginLeft: 12,
        width: 69,
    },
    hide: {
        display: 'none',
    },
    drawer: {
        width: drawerWidth,
        flexShrink: 0,
    },
    drawerPaper: {
        width: drawerWidth,

    },
    drawerHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        ...theme.mixins.toolbar,
        justifyContent: 'flex-end',
        backgroundColor: '#ff8200',
    },
    content: {
        flexGrow: 1,
        height: '90vh',
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
    },
    contentShift: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: drawerWidth,
    },
    select: {
        color: 'white',
        width: '100%',
        paddingTop: '4px',
    },
});

class Main extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            menu: [],
            open: false,
            context: null,
        };
    }

    componentDidMount() {
        let menuArr = [];
        if (this.props.auth.role === 'ADMIN') menuArr = ['Start', 'Users', 'Tenants', 'Flows', 'Components', 'Logout'];
        else menuArr = ['Start', 'Flows', 'Components', 'Logout'];
        this.setState({
            menu: menuArr,
        });
    }

    componentDidUpdate(prefProps) {
        if (prefProps.auth !== this.props.auth) {
            let menuArr = [];
            let context = null;
            if (this.props.auth.role === 'ADMIN') menuArr = ['Start', 'Users', 'Tenants', 'Flows', 'Components', 'Logout'];
            else menuArr = ['Start', 'Flows', 'Components', 'Logout'];

            if (this.props.auth.memberships && this.props.auth.memberships.length) {
                context = this.props.auth.memberships.find(tenant => tenant.name === 'Global').name;
                if (context !== 'Global') context = this.props.auth.memberships[0].name;
            }
            this.setState({
                menu: menuArr,
                context,
            });
        }
    }

  handleDrawerOpen = () => {
      this.setState({ open: true });
  };

  handleDrawerClose = () => {
      this.setState({ open: false });
  };

  logout = () => {
      this.props.logout();
  };

  getTenants = () => {
      if (this.props.auth.memberships && this.props.auth.memberships.length) {
          return this.props.auth.memberships.map((tenant, index) => <option key={`tenant-${index}`} value={tenant.name}>{tenant.name}</option>);
      }
      return null;
  }

  changeSelect = (event) => {
      this.setState({
          context: event.target.value,
      });
  }

  getMenuItems = () => <div>
      {
          this.state.menu.map((text) => {
              switch (text) {
              case 'Start':
                  return <ListItem button key={text} onClick={() => { this.props.history.push('/'); }}>
                      <ListItemIcon><HomeIcon /></ListItemIcon>
                      <ListItemText primary={text} />
                  </ListItem>;
              case 'Users':
                  return <ListItem button key={text} onClick={() => { this.props.history.push('/users'); }}>
                      <ListItemIcon><AccessibleForward /></ListItemIcon>
                      <ListItemText primary={text} />
                  </ListItem>;
              case 'Tenants':
                  return <ListItem button key={text} onClick={() => { this.props.history.push('/tenants'); }}>
                      <ListItemIcon><Business /></ListItemIcon>
                      <ListItemText primary={text} />
                  </ListItem>;
              case 'Flows':
                  return <ListItem button key={text} onClick={() => { this.props.history.push('/flows'); }}>
                      <ListItemIcon><Waves /></ListItemIcon>
                      <ListItemText primary={text} />
                  </ListItem>;
              case 'Components':
                  return <ListItem button key={text} onClick={() => { this.props.history.push('/components'); }}>
                      <ListItemIcon><Waves /></ListItemIcon>
                      <ListItemText primary={text} />
                  </ListItem>;
              case 'Logout':
                  return <ListItem button key={text} onClick={this.logout}>
                      <ListItemIcon><LockOpen /></ListItemIcon>
                      <ListItemText primary={text} />
                  </ListItem>;
              default:
                  return null;
              }
          })
      }
  </div>;

  render() {
      const { classes, theme } = this.props;
      const { open } = this.state;

      return (
          <Grid container className={classes.root}>
              <CssBaseline />
              <Drawer
                  className={classes.drawer}
                  variant="persistent"
                  anchor="left"
                  open={open}
                  classes={{
                      paper: classes.drawerPaper,
                  }}
              >
                  <div className={classes.drawerHeader}>
                      <IconButton onClick={this.handleDrawerClose}>
                          {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                      </IconButton>
                  </div>

                  <List>
                      {this.getMenuItems()}
                  </List>
              </Drawer>
              <Grid item xs={12}>
                  <AppBar
                      className={classNames(classes.appBar, {
                          [classes.appBarShift]: open,
                      })}
                  >
                      <Toolbar disableGutters={!open}>
                          <Grid container spacing={3}>
                              <IconButton
                                  color="inherit"
                                  aria-label="Open drawer"
                                  onClick={this.handleDrawerOpen}
                                  className={classNames(classes.menuButton, open && classes.hide)}
                              >
                                  <MenuIcon />
                              </IconButton>

                              {
                                  this.state.context && <Grid item sm={2}>
                                      <NativeSelect
                                          value={this.state.context}
                                          onChange={this.changeSelect}
                                          name="tenants"
                                          className={classes.select}
                                          inputProps={{ 'aria-label': 'age' }}
                                      >
                                          <option value="Global">{this.state.context}</option>
                                          {
                                              this.getTenants()
                                          }
                                      </NativeSelect>
                                  </Grid>
                              }

                              <Grid item xs={5}>
                                  <img
                                      src="https://www.openintegrationhub.org/wp-content/uploads/2018/07/oih-logo.svg"
                                      alt="Open Integration Hub"
                                      id="logo"
                                      data-height-percentage="54"
                                      data-actual-width="271"
                                      data-actual-height="40"
                                  />
                              </Grid>

                          </Grid>

                      </Toolbar>
                  </AppBar>
              </Grid>
              <Grid item xs={12}>
                  <main
                      className={classNames(classes.content, {
                          [classes.contentShift]: open,
                      })}
                  >
                      <Switch>
                          <Route exact path="/" component={Home} />
                          <Route exact path="/users" component={Users} />
                          <Route exact path="/tenants" component={Tenants} />
                          <Route exact path="/flows" component={Flows} />
                          <Route exact path="/components" component={Components} />
                      </Switch>
                  </main>
              </Grid>

          </Grid>
      );
  }
}

Main.propTypes = {
    classes: PropTypes.object.isRequired,
    theme: PropTypes.object.isRequired,
};

const mapStateToProps = state => ({
    auth: state.auth,
});
const mapDispatchToProps = dispatch => bindActionCreators({
    getUsers,
    logout,
}, dispatch);

export default flow(
    connect(
        mapStateToProps,
        mapDispatchToProps,
    ),
    withRouter,
    withStyles(styles, { withTheme: true }),
)(Main);
