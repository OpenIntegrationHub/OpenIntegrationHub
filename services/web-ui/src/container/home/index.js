import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import './index.css';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import CssBaseline from '@material-ui/core/CssBaseline';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import List from '@material-ui/core/List';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import OpenLock from '@material-ui/icons/LockOpen';
import Person from '@material-ui/icons/Person';
import { getUsers } from '../../action/users';
import UserManagement from '../usermanagement';

const drawerWidth = 240;

const styles = theme => ({
    root: {
        display: 'flex',
    },
    appBar: {
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
        marginRight: 20,
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
    },
    content: {
        flexGrow: 1,
        padding: 64,
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        marginLeft: -drawerWidth,
    },
    contentShift: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
    },
});

class Home extends React.Component {
  state = {
      menu: ['Login', 'UserManagement', 'Logout'],
      open: false,
  };

  handleDrawerOpen = () => {
      this.setState({ open: true });
  };

  handleDrawerClose = () => {
      this.setState({ open: false });
  };

  getMenuItems = () => <div>
      {
          this.state.menu.map((text) => {
              switch (text) {
              case 'UserManagement':
                  return <ListItem button key={text}>
                      <ListItemIcon><Person /></ListItemIcon>
                      <ListItemText primary={text} />
                  </ListItem>;
              case 'Logout':
                  return <ListItem button key={text}>
                      <ListItemIcon><OpenLock /></ListItemIcon>
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
          <div className={classes.root}>
              <CssBaseline />
              <AppBar
                  position="fixed"
                  className={classNames(classes.appBar, {
                      [classes.appBarShift]: open,
                  })}
              >
                  <Toolbar disableGutters={!open}>
                      <IconButton
                          color="inherit"
                          aria-label="Open drawer"
                          onClick={this.handleDrawerOpen}
                          className={classNames(classes.menuButton, open && classes.hide)}
                      >
                          <MenuIcon />
                      </IconButton>
                      <Typography variant="h6" color="inherit" noWrap>
                Open Integration Hub
                      </Typography>
                  </Toolbar>
              </AppBar>
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
              <main
                  className={classNames(classes.content, {
                      [classes.contentShift]: open,
                  })}
              >
                  <UserManagement/>

              </main>
          </div>
      );
  }
}

Home.propTypes = {
    classes: PropTypes.object.isRequired,
    theme: PropTypes.object.isRequired,
};

const mapStateToProps = state => ({
    users: state.users,
});
const mapDispatchToProps = dispatch => bindActionCreators({
    getUsers,
}, dispatch);

export default connect(
    mapStateToProps,
    mapDispatchToProps,
)(withStyles(styles, { withTheme: true })(Home));