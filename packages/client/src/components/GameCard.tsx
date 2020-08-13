import React from "react";
import { Card, Button, Flex, Box, Text } from "rimble-ui";
import RainbowBox from "./RainbowBox";
import RainbowImage from "./RainbowImage";

function GameCard({
  game
}) {
  return (
    <Box width={[1, 1 / 2, 1 / 3]} p={3}>
      <Card p={0} borderColor={"#d6d6d6"}>
        <RainbowBox height={"5px"} />
        <Flex
          alignItems={"center"}
          justifyContent={"space-between"}
          flexDirection={"column"}
          p={3}
        >
          <Flex justifyContent={"center"} mt={3} mb={4}>
            <RainbowImage src={"images/" + game.image} />
          </Flex>

          <Flex justifyContent={"center"} mt={3} mb={4}>
              <Text fontWeight={600} lineHeight={"1em"}>
                  {game.name}
              </Text>
          </Flex>

          <Button
              mt={"26px"}
              mb={2}
              type={"text"} // manually set properties on the button so that the handleInputChange and handleSubmit still work properly
              name={"recepient"} // set the name to the method's argument key
            >
              {game.button}
        </Button>
        </Flex>
      </Card>
    </Box>
  );
}

export default GameCard;