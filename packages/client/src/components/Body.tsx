import React, { useState, useEffect } from "react";
import Play from "./Play";
import TournamentView from "./TournamentView";

// import DashboardView from './DashboardView';
// import WalletView from './WalletView';
import OutplayNavigation from "./OutplayNavigation";
import { Box, Flex } from "rimble-ui";

function Body({ drizzle, drizzleState, store }) {
  const [address, setAddress] = useState(null);
  const [route, setRoute] = useState("Play");

  useEffect(() => {
    if (drizzleState) {
      setAddress(drizzleState.accounts["0"]);
    }
  }, [drizzleState]);

  const preflightCheck = () => {
    if (window.ethereum) {
      window.ethereum.enable();
    }
  };

  return (
    <Box height={"100%"}>
      <Flex
        flexDirection={"column"}
        justifyContent={"space-between"}
        height={"100%"}
      >
        <OutplayNavigation setRoute={setRoute} route={route} />
        {
          {
            Play: <Play drizzle={drizzle} drizzleState={drizzleState} />,
            TournamentView: <TournamentView address={address} store={store} setRoute={setRoute} />,
          }[route]
        }
      </Flex>
    </Box>
  );
}

export default Body;

/*
            Dashboard: <Dashboard address={address} store={store} setRoute={setRoute} />,
            Wallet:  <Wallet address={address} store={store} setRoute={setRoute} />
*/