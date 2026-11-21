"""The story library: fifteen public-domain tales and three brand-new ones (original: True), retold short (300-500
words) for ages 3-6 with the child as the main character, plus a seasonal one (season: "christmas", added 2026-11-20):
"The Night Before Christmas", the 1823 poem as first printed (verse: True, line breaks kept; about 650 words), with the
child as the listener in a new first and last page. The library sorts a story with a season first while it is in season
(client_code/books.py seasonal()). Stories people write themselves live in the user_stories
table (UserStories.py); get(key) finds either kind. The pictures for every page are drawn in the browser (web/pages/_scenes.html,
LH.SCENES[key][page]); keep the page counts in step (the flow test checks it).

Tokens in the text are filled in the browser by LH.fill (web/pages/_avatar.html) from the hero's name and
pronouns:  {name}  {he} {He}  {him}  {his} {His}  {child} (girl/boy/child)  {royal} {royals}
(princess/prince/royal). Write so "they" also reads well: past tense, no "he is / he has".
"""
import re

import anvil.server

STORIES: "list[dict]" = [
    {
        "key": "bears",
        "title": "{name} and the Three Bears",
        "plain": "The Three Bears",
        "source": "Retold from “The Story of the Three Bears” by Robert Southey (1837), in the public domain.",
        "blurb": "Porridge, three chairs, three beds, and a brand-new best friend.",
        "color": "#ef5a36",
        "pages": [
            "Once upon a time, at the edge of a sunny wood, there was a little cottage with a red door. In it lived three bears: big Papa Bear, middle-sized Mama Bear, and wee Baby Bear, who had a blue bow tie and the bounciest feet in the forest.",
            "One morning the bears made porridge for breakfast. “Too hot!” said Papa Bear. So off they went for a walk while it cooled. Just then, {name} came skipping down the path, picking daisies and humming {his} favourite song.",
            "{name} saw the little cottage and knocked on the red door. Nobody answered. The door creaked open, and a warm, sweet smell floated out. “Hello?” called {name}. Inside were three bowls of porridge on the table.",
            "{name} tried the big bowl. “Too hot!” Then the middle bowl. “Too cold!” Then the wee bowl. “Just right!” said {name}, and before {he} knew it, the little bowl was empty. Oops!",
            "Next {name} tried the chairs. The big chair was too hard. The middle chair was too squishy. The wee chair was just right, until… CRACK! It broke into pieces, and {name} landed on the floor with a bump.",
            "Feeling sleepy, {name} climbed the stairs. The big bed was too high. The middle bed was too lumpy. But the wee bed was soft and cosy, and {name} snuggled in and fell fast asleep.",
            "Soon the bears came home. “Someone’s been eating my porridge!” squeaked Baby Bear. “And someone’s broken my chair!” Up the stairs they tiptoed. “And someone is sleeping in my bed!”",
            "{name} woke up and saw three bears looking down. “I’m so sorry,” said {name}. “I ate your porridge and broke your chair. Can I help make things right?” Baby Bear thought about it, then smiled a big bear smile.",
            "So {name} helped Papa Bear glue the little chair, and Mama Bear made a fresh pot of porridge for everyone. They ate it together, not too hot and not too cold, and {name} and Baby Bear became the very best of friends.",
        ],
    },
    {
        "key": "turnip",
        "title": "{name} and the Enormous Turnip",
        "plain": "The Enormous Turnip",
        "source": "Retold from the Russian folk tale “The Turnip”, collected by Alexander Afanasyev (1863), in the public domain.",
        "blurb": "Grandpa, Grandma, a dog, a cat and one small mouse: everybody pull!",
        "color": "#3dbe8b",
        "pages": [
            "In a cheerful little garden lived Grandpa, Grandma and {name}, along with a dog, a cat and one small mouse. Every spring they planted seeds in neat rows and watered them with a bright yellow watering can.",
            "One day {name} planted a turnip seed and whispered, “Grow, little turnip, grow sweet and grow strong!” And it did. It grew and grew and GREW, until it was the most enormous turnip anybody had ever seen.",
            "“Time to pull it up for soup!” said Grandpa. He grabbed the leaves and pulled. He pulled and he pulled, but the turnip would not come up. “Grandma, come and help!” he called.",
            "Grandma held on to Grandpa, and Grandpa held on to the turnip. They pulled and they pulled, but the turnip would not come up. “{name}, come and help!” called Grandma.",
            "{name} held on to Grandma, Grandma held on to Grandpa, and Grandpa held on to the turnip. They pulled and they pulled. Still the turnip would not come up! So {name} whistled for the dog.",
            "The dog pulled {name}, and then the cat pulled the dog. They puffed and they huffed. The turnip wiggled a tiny bit, but it stayed in the ground. “We need one more helper,” said {name}. “Someone small but strong!”",
            "Out of the hedge popped the little mouse. “I can help!” she squeaked. The mouse pulled the cat, the cat pulled the dog, the dog pulled {name}, {name} pulled Grandma, Grandma pulled Grandpa, and Grandpa pulled the turnip…",
            "POP! Out came the enormous turnip, and everybody tumbled over in a giggling heap. {name} laughed so hard {his} tummy hurt. “We did it!” {he} cheered. “Even the smallest helper made the biggest difference!”",
            "That night they cooked the biggest pot of turnip soup the village had ever tasted. Everyone came to share it, and the little mouse got the very first spoonful.",
        ],
    },
    {
        "key": "porridge",
        "title": "{name} and the Magic Porridge Pot",
        "plain": "The Magic Porridge Pot",
        "source": "Retold from “Sweet Porridge” by the Brothers Grimm (1812), in the public domain.",
        "blurb": "Cook, little pot, cook! But what were the words to make it stop?",
        "color": "#ffc93c",
        "pages": [
            "In a small town full of crooked chimneys lived {name} and {his} mother. They were kind and cheerful, but some days their cupboard was empty, and their tummies rumbled like thunder.",
            "One morning {name} went into the woods to pick berries. There {he} met a kind old woman with a basket. “You have a good heart,” she said, and she gave {name} a little black pot.",
            "“This pot is magic,” whispered the old woman. “Say ‘Cook, little pot, cook!’ and it will make sweet porridge. When you have enough, say ‘Stop, little pot!’” {name} said thank you and ran all the way home.",
            "“Cook, little pot, cook!” said {name}. Bubble, bubble! The pot filled with warm, sweet porridge. “Stop, little pot!” said {name}, and it stopped. That night, {name} and {his} mother ate until they were happily full.",
            "The next day, {name} went out to play. Mother felt hungry, so she said, “Cook, little pot, cook!” The pot bubbled and filled with porridge. But Mother could not remember the magic words to make it stop!",
            "The porridge bubbled over the top. It ran across the table and spilled onto the floor. It filled the kitchen, then poured out of the door and down the street in a great, gloopy river!",
            "Neighbours climbed onto their roofs. A dog paddled past. The baker’s cat floated by on a loaf of bread. “Oh dear, oh dear!” cried everyone. Soon only one house in the whole town was left without porridge.",
            "Just then {name} came running home. {He} took a deep breath and shouted as loudly as {he} could, “STOP, LITTLE POT!” And with one last bloop, the pot stopped.",
            "Anyone who wanted to get back into town that day had to eat their way home! {name} grabbed the biggest spoon and started first. And from then on, everybody remembered the magic words.",
        ],
    },
    {
        "key": "emperor",
        "title": "{name} and the Emperor’s New Clothes",
        "plain": "The Emperor’s New Clothes",
        "source": "Retold from “The Emperor’s New Clothes” by Hans Christian Andersen (1837), in the public domain.",
        "blurb": "Everybody pretends. Only one brave voice tells the truth.",
        "color": "#8a6bd8",
        "pages": [
            "Long ago there lived an Emperor who loved new clothes more than anything. He had a coat for every hour of the day and a hat for every kind of weather. {name} lived in his city and loved to watch his parades.",
            "One day two tricksters came to town. “We weave the most wonderful cloth in the world,” they said. “It is so special that anyone who is silly or bad at their job cannot see it at all!”",
            "The Emperor gave them bags of gold. The tricksters set up two looms and pretended to weave all day and all night. But their looms were completely empty. There was no cloth at all!",
            "The Emperor sent his wisest minister to look. The minister saw nothing. “Oh no,” he thought. “Does this mean I am silly?” So he said, “How beautiful! What colours!” Nobody wanted to say they saw nothing.",
            "At last the suit was ready. The tricksters pretended to dress the Emperor, one invisible sleeve at a time. “Light as a feather,” they said. The Emperor turned this way and that in front of the mirror.",
            "Then the great parade began. Trumpets played and flags waved. The whole town lined the streets. “What a marvellous suit!” everyone cried, even though all they could see were the Emperor’s spotty underpants.",
            "{name} was standing at the front of the crowd. {He} looked at the Emperor, and then looked again. Then {name} said, loudly and clearly, “But the Emperor isn’t wearing any clothes!”",
            "There was a hush. Then someone giggled. Then everyone laughed. “{name} is right!” they said. The Emperor’s cheeks went pink. He knew it was true, so he started to laugh too.",
            "The Emperor thanked {name} for being brave and honest. He gave {name} a shiny medal, and from that day on he always listened when someone told him the truth, even when it was a little bit funny.",
        ],
    },
    {
        "key": "beanstalk",
        "title": "{name} and the Beanstalk",
        "plain": "The Magic Beanstalk",
        "source": "Retold from “Jack and the Beanstalk” in Joseph Jacobs’ English Fairy Tales (1890), in the public domain.",
        "blurb": "Five magic beans, a beanstalk to the clouds, and a lonely giant.",
        "color": "#4ea8f5",
        "pages": [
            "{name} lived in a tiny cottage with {his} mother and a gentle cow named Milky-White. One day, Milky-White stopped giving milk, and the cupboard was nearly bare. “Take her to market,” said Mother, “and sell her for a good price.”",
            "On the way, {name} met a funny little man with a feather in his hat. “I’ll trade you these five magic beans for your cow,” he said. The beans sparkled like tiny jewels, so {name} said yes.",
            "Mother was not pleased. “Beans? Just beans?” she cried, and she tossed them out of the window. But that night, while {name} slept, something amazing happened. The beans began to grow.",
            "In the morning, a huge beanstalk reached all the way up into the clouds! {name} grabbed a leaf, then another, and climbed, and climbed, and climbed, higher than the birds, until {he} stepped onto a fluffy cloud.",
            "On the cloud stood an enormous castle. {name} knocked on the gigantic door. BOOM, BOOM, BOOM went the footsteps. “FEE-FI-FO-FUM!” rumbled a voice, and a giant peered down at {name}, very surprised.",
            "The giant looked grumpy, but {name} noticed a tear in his eye. “Nobody ever visits me,” sniffed the giant. “Everyone runs away.” So {name} said, “I’ll visit! Would you like to play a game?”",
            "They played hide-and-seek in the giant’s garden, where the daisies were as big as umbrellas. The giant laughed so hard that the whole cloud wobbled, and his hen clucked and laid a shining golden egg.",
            "“Take this, my friend,” said the giant, and he gave {name} the golden egg. “Please come back and play again.” {name} promised {he} would, and climbed all the way back down the beanstalk.",
            "With the golden egg, {name} and Mother bought Milky-White back and filled the cupboard with good things. And every Sunday, {name} climbed the beanstalk to play with {his} giant friend in the clouds.",
        ],
    },
    {
        "key": "hen",
        "title": "{name} and the Little Red Hen",
        "plain": "The Little Red Hen",
        "source": "Retold from the traditional folk tale “The Little Red Hen” (printed in the 1870s), in the public domain.",
        "blurb": "“Not I!” said the Cat, the Dog and the Duck. “I will!” said our hero.",
        "color": "#ff8fb8",
        "pages": [
            "On a busy little farm lived a Little Red Hen, a sleepy Cat, a lazy Dog and a noisy Duck. {name} lived on the farm too, and loved to help with everything, from feeding the chicks to counting the eggs.",
            "One morning the Little Red Hen found some grains of wheat. “Who will help me plant this wheat?” she asked. “Not I,” yawned the Cat. “Not I,” sighed the Dog. “Not I,” quacked the Duck. “I will!” said {name}.",
            "So {name} and the Little Red Hen planted the wheat in neat little rows. The sun shone and the rain fell, and the wheat grew tall and golden, right up to {name}’s nose.",
            "“Who will help me cut the wheat?” asked the Little Red Hen. “Not I,” said the Cat, the Dog and the Duck, without even opening their eyes. “I will!” said {name}, and off they went to the field.",
            "“Who will help me take the wheat to the mill?” “Not I,” said the Cat, the Dog and the Duck. “I will!” said {name}. Together they pulled a creaky cart to the windmill, where the wheat was ground into soft white flour.",
            "“Who will help me bake the bread?” asked the Little Red Hen. “Not I!” said the Cat, the Dog and the Duck. “I will!” said {name}. They mixed and kneaded and waited for the dough to puff up big and round.",
            "Soon a warm, golden loaf came out of the oven. The smell drifted all over the farm, and suddenly the Cat, the Dog and the Duck were wide awake. “Who will help me eat the bread?” asked the Little Red Hen.",
            "“I will!” said the Cat. “I will!” said the Dog. “I will!” said the Duck. The Little Red Hen shook her head. “You did not help plant it, cut it or bake it. {name} and I did all the work.”",
            "The Cat, the Dog and the Duck looked down at their paws and feet. “Next time, we’ll help,” they said. {name} smiled and gave each of them a piece anyway. “Next time,” said {name}, “we’ll bake two loaves together!”",
        ],
    },
    {
        "key": "elves",
        "title": "{name} and the Elves",
        "plain": "The Elves and the Shoemaker",
        "source": "Retold from “The Elves and the Shoemaker” by the Brothers Grimm (1812), in the public domain.",
        "blurb": "Who is making the shoes at midnight? A cosy tale of kindness.",
        "color": "#2fa39b",
        "pages": [
            "{name} lived above a little shoe shop with {his} dad, the shoemaker. Dad made fine shoes, but times were hard. One evening he had only enough leather left for one last pair.",
            "Dad cut out the leather and laid it on his workbench, ready to sew in the morning. “Goodnight, little shoes,” said {name}, and they both went up to bed.",
            "In the morning, {name} raced downstairs. On the workbench stood a beautiful pair of shoes, with tiny, neat stitches. “Who made these?” gasped Dad. A lady bought them straight away and paid enough for leather for two more pairs.",
            "That night Dad cut out two pairs, and in the morning two beautiful pairs were finished! The next night four, then eight. Soon the shop was full of happy customers, and everyone in town wanted shoes from the little shop.",
            "“Who could be helping us?” wondered {name}. So one night, {name} and Dad hid behind a curtain with a candle. At midnight, two little elves skipped in through the window and began to sew, tap-tap-tap, as fast as they could.",
            "{name} noticed something. The elves had no coats and no shoes, and their little toes looked cold. “They have helped us so much,” whispered {name}. “Let’s make them something too.”",
            "So {name} and Dad got busy. Dad made two tiny pairs of shoes. {name} sewed two tiny coats, knitted two tiny scarves and made two tiny hats with bobbles on top. They laid the presents on the workbench.",
            "At midnight the elves found the presents. They squealed with joy, put on their new clothes and danced around the workshop. “Now we are fine and warm!” they sang, and away they skipped through the window.",
            "The elves never came back to sew, but they did not need to. The shop stayed busy and happy. And whenever {name} found a tiny bobble-hat drawn in the frost on the window, {he} knew the elves were saying hello.",
        ],
    },
    {
        "key": "pea",
        "title": "{name} and the Pea",
        "plain": "The Princess and the Pea",
        "source": "Retold from “The Princess and the Pea” by Hans Christian Andersen (1835), in the public domain.",
        "blurb": "Twenty mattresses, twenty quilts, and one tiny green pea.",
        "color": "#5b8def",
        "pages": [
            "Once upon a time, in a castle on a hill, lived a King and a Queen. They had heard many stories about real {royals}, who were so gentle that they could feel the tiniest thing. “I wonder if any are left,” said the Queen.",
            "One stormy night, the rain poured down and the thunder rumbled. KNOCK, KNOCK, KNOCK! At the castle gate stood {name}, soaking wet from head to toe, with water running out of {his} shoes.",
            "“I got lost in the storm,” said {name}. “May I stay the night? At home they call me a real {royal}.” The King raised an eyebrow. The Queen smiled a secret smile. “We shall see,” she said.",
            "While {name} drank warm cocoa by the fire, the Queen crept into the guest room. She put one tiny green pea on the bed. Then she piled twenty mattresses on top of it, and twenty fluffy quilts on top of those.",
            "The bed was so tall that {name} needed a ladder to climb in. “Goodnight!” called the King and Queen from far below. {name} waved from the very top, close enough to touch the ceiling.",
            "But {name} could not sleep. {He} wiggled to the left and wobbled to the right. {He} counted sheep, then goats, then ducks. All night long, something small and hard poked {him} in the back.",
            "In the morning, the Queen asked, “Did you sleep well?” “Not a wink!” yawned {name}. “There was something lumpy in my bed. I think I’m black and blue!” The King and Queen gasped with delight.",
            "“Only a real {royal} could feel one tiny pea through twenty mattresses and twenty quilts!” cried the Queen. They gave {name} a golden crown and the biggest breakfast in the whole kingdom.",
            "And the pea? It was put in the royal museum, where you can still see it today, unless somebody has eaten it. {name} visited the castle every summer, and always slept on just one mattress.",
        ],
    },
    {
        "key": "gingerbread",
        "title": "{name} and the Gingerbread Man",
        "plain": "The Gingerbread Man",
        "source": "Retold from “The Gingerbread Boy”, printed in St. Nicholas Magazine (1875), in the public domain.",
        "blurb": "Run, run, as fast as you can! A cookie on the loose and a very sly fox.",
        "color": "#d9823b",
        "pages": [
            "One snowy morning, {name} and Grandma baked gingerbread. {name} shaped the very last bit of dough into a little man, with raisin eyes, a cherry nose and three shiny sweets for buttons.",
            "Into the oven he went. {name} pressed {his} nose to the oven door and waited. Soon a warm, spicy smell filled the whole kitchen. “He must be ready!” said Grandma, and she opened the door.",
            "Out jumped the Gingerbread Man! He hopped onto the table, wiggled his crumbly legs and ran straight out of the door. “Run, run, as fast as you can! You can’t catch me, I’m the Gingerbread Man!”",
            "“Come back!” called {name}, and off {he} ran after him, with Grandma close behind. The Gingerbread Man raced past a cow in the meadow. “Moo, stop!” said the cow. But he only ran faster.",
            "He ran past a horse and past the farmers making hay. Soon everyone joined the chase: Grandma, the cow, the horse and the farmers, with {name} leading the way. “Run, run, as fast as you can!” sang the Gingerbread Man.",
            "At last he came to a wide river and stopped. He could not swim, because gingerbread goes soggy. Out of the reeds stepped a sly red fox. “Hop on my tail,” said the fox with a big toothy smile. “I’ll carry you across.”",
            "The Gingerbread Man hopped onto the fox’s tail, then onto his back, then onto his nose. “Snip, snap!” went the fox. But just in time, {name} came running along the riverbank. “Jump, little cookie!” {he} shouted. “Jump to me!”",
            "The Gingerbread Man jumped, flew through the air and landed safely in {name}’s hands. The fox sighed. “Oh well,” he said, “I was only a little bit hungry.” So {name} gave him a crunchy apple instead.",
            "Back home, {name} and Grandma baked a whole family of gingerbread friends, so the Gingerbread Man would never feel lonely again. And nobody ran away, because everyone was far too busy dancing at the cookie party.",
        ],
    },
    {
        "key": "duckling",
        "title": "{name} and the Ugly Duckling",
        "plain": "The Ugly Duckling",
        "source": "Retold from “The Ugly Duckling” by Hans Christian Andersen (1843), in the public domain.",
        "blurb": "Too big, too grey, too different, until one bright spring morning.",
        "color": "#5fb8e0",
        "pages": [
            "Down by the farm pond, a mother duck sat on her nest. One by one her eggs went crack, and out came fluffy yellow ducklings. But the biggest egg took the longest of all, and {name} came every day to see if it had hatched.",
            "At last, CRACK! Out tumbled a big grey duckling with a long neck and enormous feet. “Oh my,” said Mother Duck. “He doesn’t look like the others.” {name} knelt down and smiled. “Hello, little one,” {he} said.",
            "The other ducklings would not play with him. The hens pecked at him and the turkey gobbled at him. “Too big!” they quacked. “Too grey!” The grey duckling hung his head, so {name} gave him a gentle hug.",
            "One day the duckling ran away across the marshes. {name} searched the reeds and the wide, wet fields, calling, “Little duckling, where are you?” Wild geese honked overhead, but nobody had seen him.",
            "Summer turned to autumn, and the leaves turned gold. One evening {name} saw a flock of beautiful white birds flying south, with long necks and wide, shining wings. Far away in the reeds, the grey duckling watched them too.",
            "Then winter came, and the pond froze hard. {name} found the duckling stuck in the ice, shivering and tired. {He} wrapped him in {his} warmest scarf and carried him all the way home.",
            "All winter long, the duckling stayed by the fire with {name}. They read stories, shared bread crumbs and watched the snow fall. The duckling grew bigger and bigger, and his grey feathers slowly began to change.",
            "When spring came, {name} carried him back to the pond. There were the beautiful white birds, gliding on the water. The duckling bowed his head shyly and saw his reflection. He was not a duckling at all. He was a swan!",
            "The swans welcomed him with happy, flapping wings. “You were a swan all along,” laughed {name}. And every spring after that, the swan came back to the pond to say hello to his oldest friend.",
        ],
    },
    {
        "key": "goats",
        "title": "{name} and the Billy Goats Gruff",
        "plain": "The Three Billy Goats Gruff",
        "source": "Retold from “The Three Billy Goats Gruff” in Asbjørnsen and Moe’s Norwegian folk tales (1840s), translated by George Webbe Dasent (1859), in the public domain.",
        "blurb": "Trip, trap over the bridge! But who is grumbling underneath?",
        "color": "#8cc04b",
        "pages": [
            "High in the mountains, {name} looked after three billy goats called Gruff: a little one, a middle-sized one and a great big one with curly horns. All three of them loved to munch and crunch the grass.",
            "One day the grass on their hill was all eaten up. Across the river was a meadow full of sweet green grass and yellow flowers. “Let’s go over the bridge!” said {name}. But under that bridge lived a grumpy troll.",
            "First the little goat went trip, trap, trip, trap over the bridge. “WHO’S THAT TRIP-TRAPPING OVER MY BRIDGE?” roared the troll, popping up. “I’m going to gobble you up!” “Oh, please don’t,” said the little goat. “Wait for my bigger brother.”",
            "Next the middle goat went TRIP, TRAP over the bridge. “WHO’S THAT?” roared the troll. “Don’t gobble me,” said the middle goat. “Wait for my biggest brother. He’s much bigger than me.”",
            "Then the great big goat went TRIP, TRAP, TRIP, TRAP, and the whole bridge shook. The troll jumped up, the big goat lowered his curly horns, and {name} ran onto the bridge just in time. “STOP!” {he} cried. “Nobody needs to fight!”",
            "{name} looked at the troll. “Why are you so grumpy?” {he} asked. The troll’s lip wobbled. “My tummy rumbles all day long,” he said, “and nobody ever stops to say hello. They just trip-trap past.”",
            "So {name} opened {his} backpack and shared {his} picnic: cheese sandwiches, red apples and a big slice of cake. The troll had never tasted cake before. He smiled so wide that his ears wiggled.",
            "After lunch, the troll helped {name} mend the wobbly planks of the bridge, and the goats trotted across to the meadow. They munched and crunched until they were as round as barrels.",
            "From that day on, the troll was the friendly keeper of the bridge. Whenever {name} and the goats went trip-trapping over, he waved hello, and every Friday they all had a picnic together by the river.",
        ],
    },
    {
        "key": "tortoise",
        "title": "{name} and the Great Race",
        "plain": "The Tortoise and the Hare",
        "source": "Retold from Aesop’s fable “The Hare and the Tortoise”, as translated by George Fyler Townsend (1867), in the public domain.",
        "blurb": "A boastful hare, a steady tortoise, and the slowest race ever won.",
        "color": "#e9a23b",
        "pages": [
            "In a green meadow full of clover lived a speedy Hare and a slow, gentle Tortoise. {name} loved to visit them both. The Hare liked to zoom round and round in circles, and the Tortoise liked to watch the clouds.",
            "“I’m the fastest animal in the whole meadow!” boasted the Hare. “You’re so slow, Tortoise, you’d lose a race to a snail.” The Tortoise blinked slowly. “Let’s have a race and see,” he said. Everyone gasped.",
            "{name} drew a starting line in the dust and tied a red ribbon between two trees for the finish. All the animals came to watch: rabbits, squirrels, birds and a family of hedgehogs. “Ready, steady… GO!” shouted {name}.",
            "WHOOSH! The Hare shot off like an arrow and was soon far away. The Tortoise took one slow step, then another, then another. “Keep going!” cheered {name}, walking beside him. “Slow and steady!”",
            "The Hare looked back and couldn’t even see the Tortoise. “This is too easy,” he yawned. “I’ll have a little nap under this shady tree.” And soon he was snoring away, dreaming of crunchy carrots.",
            "Step by step, the Tortoise kept going: up the hill, across the stream and through the long grass. {name} and the animals sang a song to help: “Slow and steady, step by step, keep on going, don’t forget!”",
            "The Tortoise plodded right past the sleeping Hare. {name} put a finger to {his} lips. “Shhh!” whispered everyone. And on went the Tortoise, closer and closer to the red ribbon.",
            "The Hare woke up with a jump. He raced as fast as his long legs could go, but it was too late. The Tortoise stepped over the line and broke the ribbon. “The Tortoise wins!” cheered {name}.",
            "The Hare puffed and blushed. “Well done, Tortoise,” he said at last. {name} gave the Tortoise a daisy medal, and the Hare learned that slow and steady can win the race. The next day, they all went for a slow walk together.",
        ],
    },
    # ---- added 2026-11-17: three more classics and three brand-new stories (original: True)
    {
        "key": "lion",
        "title": "{name}, the Lion and the Mouse",
        "plain": "The Lion and the Mouse",
        "source": "Retold from Aesop’s fable “The Lion and the Mouse”, in the public domain.",
        "blurb": "A mighty roar, a tiny squeak, and a promise kept.",
        "color": "#f0a04b",
        "pages": [
            "Far away, where the grass grew tall and golden, {name} went walking in the warm sunshine. Under a flat-topped tree lay a great big Lion, fast asleep, snoring so loudly that the leaves above him shook.",
            "A tiny grey Mouse came scampering through the grass. She was in such a hurry that she ran right up the Lion’s tail, over his back and across his nose! The Lion woke with a snort and trapped her under one enormous paw.",
            "“Please let me go!” squeaked the Mouse. “If you do, one day I will help you.” The Lion laughed a rumbly laugh. “You? Help ME?” {name} knelt down beside them. “Be kind, Lion,” {he} said softly. So the Lion lifted his paw, and the Mouse scurried away.",
            "The very next morning, {name} heard a mighty ROAR. {He} ran through the grass and found the Lion tangled in an old rope net that someone had left behind. The more he wriggled, the tighter it pulled.",
            "{name} tugged at the knots with all {his} strength, but they were far too tight. “Don’t worry, Lion,” {he} said. “We will find a way.” The Lion gave a sad little rumble and rested his head on his paws.",
            "Just then, a small voice called out, “I can help!” It was the tiny grey Mouse. She climbed up onto the net, looked at the thick rope, and began to nibble with her sharp little teeth. Nibble, nibble, nibble.",
            "Snip went one rope. Snap went another. {name} held the net open while the Mouse nibbled and nibbled. Then, with one last snip, the net fell away. The Lion shook his great golden mane. He was free!",
            "“Thank you, little friend,” said the Lion, bowing his head until his nose touched the Mouse’s nose. “I laughed at you, and I was wrong.” The Mouse smiled. “Even the smallest friend can be the biggest help,” she said.",
            "From that day on, the three of them were the best of friends. The Lion gave {name} rides across the golden grass, the Mouse sat in his soft mane like a queen, and every evening they watched the sun go down together.",
        ],
    },
    {
        "key": "stonesoup",
        "title": "{name} and the Stone Soup",
        "plain": "Stone Soup",
        "source": "Retold from the European folk tale “Stone Soup”, in the public domain.",
        "blurb": "One big pot, one smooth stone, and a whole village of helpers.",
        "color": "#8a6bd8",
        "pages": [
            "One chilly autumn day, {name} and a kind old traveller came walking into a little village. They had walked a long way, and their tummies were rumbling. All they carried was one big, empty cooking pot.",
            "They knocked on every door. “Could you spare a little food?” they asked. But everyone shook their heads. “We have hardly anything ourselves,” they said, and one by one the doors closed.",
            "{name} sat down by the village well and thought very hard. Then {he} smiled. {He} filled the pot with water, picked up a smooth, round stone and dropped it in. Plop! “We are making stone soup!” {he} called out.",
            "One by one, windows opened and faces peeked out. “Stone soup? What is that?” asked a little girl. “It is delicious,” said {name}, stirring the pot. “But it would be even better with a carrot.” The girl ran home and came back with three.",
            "“I have an onion!” said a man with a big moustache. “And I have potatoes!” said a lady with a basket. A boy brought a cabbage, and his grandpa brought a bundle of herbs. Into the pot it all went. Bubble, bubble!",
            "Soon there were beans and peas and a pinch of salt, and the baker brought warm bread for dipping. A wonderful smell drifted through the whole village. Even the cat came to sniff.",
            "The villagers carried out tables and chairs and hung bright flags across the square. Everybody brought a bowl and a spoon. “Is it ready?” asked the little girl. {name} took a taste. “It is perfect!”",
            "Everyone ate together, laughing and chatting and passing the bread. “This is the best soup we have ever had,” they said. “And it was made from a stone!” {name} winked at the old traveller.",
            "When it was time to go, {name} gave the stone to the little girl. “Keep it for the next cold day,” {he} said. “But the real secret was never the stone. It was all of you, sharing.” And the whole village cheered.",
        ],
    },
    {
        "key": "mice",
        "title": "{name}, the Town Mouse and the Country Mouse",
        "plain": "The Town Mouse and the Country Mouse",
        "source": "Retold from Aesop’s fable “The Town Mouse and the Country Mouse”, in the public domain.",
        "blurb": "Fancy cakes in town, or peace and berries at home?",
        "color": "#4ea8f5",
        "pages": [
            "At the edge of a sunny meadow, under the roots of an old oak tree, lived a little Country Mouse. {name} visited her every day. Together they gathered seeds and berries and sang to the bees.",
            "One day her cousin, the Town Mouse, came to visit, wearing a smart bow tie. The Country Mouse served her very best seeds and berries. The Town Mouse sniffed. “Is that all? Come to town with me, and I will show you a real feast!”",
            "So off they went: the Country Mouse, the Town Mouse and {name}, riding on the back of a farmer’s cart, bumping and rattling all the way to town. The Country Mouse held on tight to {name}’s sleeve.",
            "In the town there was a tall house, and in the tall house was a long table, and on the long table was the grandest feast: cakes and cheese, jelly and buns. “Help yourselves!” said the Town Mouse.",
            "But just as they took their first nibble, the door swung open. “MEOW!” In came a big ginger cat! The mice dashed behind the teapot, and {name} waved {his} arms. “Shoo, Cat! Leave them alone!”",
            "The cat went away, but then a big dog bounded in. “WOOF!” Off ran the mice again, into a little hole in the wall. Their hearts went pitter-patter, pitter-patter, as fast as raindrops.",
            "The Country Mouse peeped out, shaking from her nose to her tail. “Thank you, cousin,” she said kindly. “Your food is very grand. But I would rather eat seeds and berries in peace than cake with a cat.”",
            "So {name} carried the Country Mouse home under the twinkling stars. They walked past sleepy cows and quiet fields, and the Country Mouse smiled more with every step.",
            "Back in her cosy home under the oak tree, they shared a supper of berries. “There is no place like home,” said the Country Mouse. And the Town Mouse? She still comes to visit, and now she loves berries too.",
        ],
    },
    {
        "key": "star",
        "title": "{name} and the Lost Little Star",
        "plain": "The Lost Little Star",
        "source": "A brand-new story, written for Little Hero Books.",
        "blurb": "A star fell into the garden. Can your hero help it home before morning?",
        "color": "#463e8c",
        "original": True,
        "pages": [
            "One summer night, {name} was looking out of {his} bedroom window when a tiny star wobbled in the sky. It wiggled, it jiggled, and then WHOOSH! It tumbled all the way down into the garden.",
            "{name} pulled on {his} slippers and tiptoed outside with a torch. There, in the flower bed, was the little star, glowing softly and sniffling. “I fell,” it whispered. “And I don’t know how to get home.”",
            "“Don’t cry,” said {name}. “I will help you.” {He} fetched the tallest ladder in the shed and climbed up and up, holding the star high. But the sky was much, much higher than the ladder.",
            "Up in the old apple tree sat a wise Owl. “Hoo-hoo,” said the Owl. “Stars ride home on the night wind. What you need is something that flies.” {name} thought for a moment. “A kite!” {he} cried.",
            "So {name} and the little star made a kite out of paper, sticks and string. They gave it a long tail with bright bows. The star sparkled with happiness, and the paper shone like gold.",
            "Together they climbed to the top of the big green hill, where the wind blew the strongest. The grass whispered, the crickets sang, and the moon smiled down to light the way.",
            "Whoosh! A gust of wind lifted the kite. The little star held on tight to the tail. “Higher!” called {name}, letting out the string. Up and up they went, past the treetops, past the clouds.",
            "With one last wiggle, the little star hopped back into its place in the sky and twinkled brighter than ever. All the other stars twinkled too, and for a moment they made the shape of a heart.",
            "{name} walked home and snuggled into bed. And from that night on, every evening, one little star twinkles extra bright at {his} window, just to say goodnight.",
        ],
    },
    {
        "key": "puddles",
        "title": "{name}’s Puddle Parade",
        "plain": "The Puddle Parade",
        "source": "A brand-new story, written for Little Hero Books.",
        "blurb": "Rain, rain, don’t go away: there is a parade today!",
        "color": "#3dbe8b",
        "original": True,
        "pages": [
            "Pitter, patter, pitter, patter. It rained all morning long. {name} pressed {his} nose against the window and sighed. “No park today,” {he} said. Even the cat on the windowsill looked grumpy, and the swings in the park were dripping wet.",
            "Then Mum came in with a bright yellow raincoat, a pair of red boots and a big umbrella. “Rain isn’t for staying in,” she said with a wink. “Rain is for puddles!”",
            "Outside, the first puddle was waiting. {name} jumped right in. SPLASH! A mother duck and her three ducklings waddled over. “Quack! May we come too?” “Of course,” said {name}. “Let’s have a parade!”",
            "Off they marched down the lane: {name} in front, the ducks behind, quack, quack, quack. A green frog hopped out of the ditch with a tiny drum. “Every parade needs music!” he croaked. Boom, boom, boom!",
            "At the bottom of the hill was the biggest puddle of all, as big as a pond and as shiny as a mirror. “One, two, three, JUMP!” called {name}. SPLOOSH! Everyone got wonderfully wet.",
            "Under a bench sat a little cat who did not like the rain one bit. She was shivering. {name} held out the big umbrella. “Come and walk with us,” {he} said. “You can stay dry under here.”",
            "Slowly the rain stopped. The clouds rolled away, the sun peeped out, and across the sky stretched an enormous rainbow: red, orange, yellow, green, blue and purple.",
            "The puddle parade marched all the way to the end of the rainbow. The ducks flapped, the frog drummed, the cat purred, and {name} took a bow. Hooray for the rain!",
            "Back home, {name} left the muddy boots by the door and sipped a cup of warm cocoa. {He} looked out of the window at the sky and smiled. “I hope it rains again tomorrow,” {he} said.",
        ],
    },
    {
        "key": "dragon",
        "title": "{name} and the Hiccupy Dragon",
        "plain": "The Hiccupy Dragon",
        "source": "A brand-new story, written for Little Hero Books.",
        "blurb": "HIC! Every hiccup pops out popcorn. Who can help Pip stop?",
        "color": "#59b45e",
        "original": True,
        "pages": [
            "High on the purple mountain lived a little green dragon called Pip. Pip had a big problem. For three whole days Pip had the hiccups, and with every HIC! out popped a puff of warm popcorn.",
            "Down in the village, popcorn was falling everywhere. It landed on roofs, in gardens and on people’s hats. “Where is all this popcorn coming from?” everyone asked. {name} looked up at the mountain. “I think I know,” {he} said.",
            "{name} climbed all the way up the mountain path and found Pip sitting outside a cave, looking very sorry. “I can’t stop hiccuping,” said Pip. “HIC!” And a shower of popcorn tumbled out.",
            "“Let’s try a drink of water,” said {name}. Pip drank a whole bucket, gulp, gulp, gulp. Pip waited. Everything was quiet. Then… “HIC!” Popcorn bounced all over the rocks.",
            "“Try holding your breath while I count to ten,” said {name}. Pip puffed out big green cheeks. One, two, three, four, five… Pip’s face turned from green to purple. “HIC!” Out came even more popcorn.",
            "“Maybe a surprise will help,” said {name}. {He} hid behind a rock, then jumped out. “BOO!” Pip giggled so much that they both fell over. It was very funny. But… “HIC!”",
            "{name} sat down next to Pip. “Let’s just breathe slowly,” {he} said. “In through your nose, like smelling a flower. Out through your mouth, like blowing out a candle.” They breathed in, and out, in, and out, together.",
            "The mountain was quiet. Pip listened. Nothing happened. No HIC! No popcorn! “They’re gone!” cheered Pip, and puffed out a tiny, happy flame that toasted a marshmallow just right for {name}.",
            "That evening the whole village had a popcorn party with all the popcorn from the hills. Pip flew {name} home across the sunset sky. And if Pip ever gets the hiccups again, they both know just what to do.",
        ],
    },
    {
        "key": "christmas",
        "title": "{name}’s Night Before Christmas",
        "plain": "The Night Before Christmas",
        "source": "“A Visit from St. Nicholas”, first printed in the Troy Sentinel (1823) and attributed to Clement Clarke Moore, in the public domain. The poem is printed as first published; the opening and closing pages are new.",
        "blurb": "The famous Christmas Eve poem, read to your hero at bedtime: a sleigh, eight tiny reindeer and a jolly visitor.",
        "color": "#c8372d",
        "season": "christmas",
        "verse": True,
        "pages": [
            "It was Christmas Eve. The stockings were hung, the tree was twinkling, and {name} was much too excited to sleep. “Please read me the Christmas poem,” {he} whispered, “the one about the night before Christmas.” So the lamp was turned down low, the old book was opened, and the poem began…",
            "’Twas the night before Christmas, when all thro’ the house,\nNot a creature was stirring, not even a mouse;\nThe stockings were hung by the chimney with care,\nIn hopes that St. Nicholas soon would be there;\nThe children were nestled all snug in their beds,\nWhile visions of sugar plums danc’d in their heads,\nAnd Mama in her ’kerchief, and I in my cap,\nHad just settled our brains for a long winter’s nap—",
            "When out on the lawn there arose such a clatter,\nI sprung from the bed to see what was the matter,\nAway to the window I flew like a flash,\nTore open the shutters, and threw up the sash.\nThe moon on the breast of the new fallen snow,\nGave the lustre of mid-day to objects below;\nWhen, what to my wondering eyes should appear,\nBut a miniature sleigh, and eight tiny rein-deer,",
            "With a little old driver, so lively and quick,\nI knew in a moment it must be St. Nick.\nMore rapid than eagles his coursers they came,\nAnd he whistled, and shouted, and call’d them by name:\n“Now! Dasher, now! Dancer, now! Prancer, and Vixen,\n“On! Comet, on! Cupid, on! Dunder and Blixem;\n“To the top of the porch! to the top of the wall!\n“Now dash away! dash away! dash away all!”",
            "As dry leaves before the wild hurricane fly,\nWhen they meet with an obstacle, mount to the sky;\nSo up to the house-top the coursers they flew,\nWith the sleigh full of Toys—and St. Nicholas too:\nAnd then in a twinkling, I heard on the roof\nThe prancing and pawing of each little hoof.\nAs I drew in my head, and was turning around,\nDown the chimney St. Nicholas came with a bound:",
            "He was dress’d all in fur, from his head to his foot,\nAnd his clothes were all tarnish’d with ashes and soot;\nA bundle of toys was flung on his back,\nAnd he look’d like a peddler just opening his pack:\nHis eyes—how they twinkled! his dimples how merry,\nHis cheeks were like roses, his nose like a cherry;\nHis droll little mouth was drawn up like a bow,\nAnd the beard of his chin was as white as the snow;",
            "The stump of a pipe he held tight in his teeth,\nAnd the smoke it encircled his head like a wreath.\nHe had a broad face, and a little round belly\nThat shook when he laugh’d, like a bowl full of jelly:\nHe was chubby and plump, a right jolly old elf,\nAnd I laugh’d when I saw him in spite of myself;\nA wink of his eye and a twist of his head\nSoon gave me to know I had nothing to dread.",
            "He spoke not a word, but went straight to his work,\nAnd fill’d all the stockings; then turn’d with a jirk,\nAnd laying his finger aside of his nose\nAnd giving a nod, up the chimney he rose.\nHe sprung to his sleigh, to his team gave a whistle,\nAnd away they all flew like the down of a thistle:\nBut I heard him exclaim, ere he drove out of sight—\nHappy Christmas to all, and to all a good night.",
            "By the very last line, {name}’s eyes were closing. Outside, the snow fell softly, and far away, high above the rooftops, something jingled. In the morning the stockings were full to the top, and under the tree, tied with a red ribbon, was a tiny silver bell with a note: “For {name}. Happy Christmas!”",
        ],
    },
]
BY_KEY: "dict[str, dict]" = {s["key"]: s for s in STORIES}
TOKENS = {"name", "he", "He", "him", "his", "His", "child", "royal", "royals"}
SAMPLE = {"name": "Mila", "he": "she", "He": "She", "him": "her", "his": "her", "His": "Her", "child": "girl",
          "royal": "princess", "royals": "princesses"}


def fill(text, values=None):
    values = values or SAMPLE
    return re.sub(r"\{(\w+)\}", lambda m: values.get(m.group(1), m.group(0)), text)


def words(story):
    return sum(len(fill(p).split()) for p in story["pages"])


def meta(s):
    """What the library and the shelf show (no page text). Stories people wrote (UserStories.py) also carry the
    pictures they borrow: pics[i] / cover = "storykey:page" (LH.picRef in lh-scenes.js draws them)."""
    n = words(s)
    out = {"key": s["key"], "title": s["title"], "plain": s["plain"], "source": s["source"], "blurb": s["blurb"],
           "color": s["color"], "pages": len(s["pages"]), "words": n,
           "minutes": max(1 if s.get("custom") else 2, round(n / 110)), "original": bool(s.get("original")),
           "season": s.get("season") or "", "verse": bool(s.get("verse"))}
    if s.get("custom"):
        out.update(custom=True, pics=list(s["pics"]), cover=s["cover"], base=s.get("base") or "",
                   updated=s.get("updated"))
    return out


def full(s):
    out = meta(s)
    out["text"] = list(s["pages"])
    return out


def is_user_key(key):
    return isinstance(key, str) and key.startswith("u-")


def get(key):
    """Any story by key: one of the library's, or one somebody wrote (for books, family links, recordings and painting).
    Callers that show a written story to someone check who owns it (owner_of)."""
    if not isinstance(key, str):
        return None
    if key in BY_KEY:
        return BY_KEY[key]
    if is_user_key(key):
        from . import UserStories
        return UserStories.story_of(key)
    return None


def owner_of(key):
    """The users row that wrote this story, or None for the library's own stories."""
    if not is_user_key(key):
        return None
    from . import UserStories
    row = UserStories.row_of(key)
    return row["owner"] if row is not None else None


@anvil.server.callable
def get_story(key):
    """One story with its text: the library's are public (public-domain tales and our own); a story somebody wrote
    opens only for them (their books' family links go through get_shared_book instead)."""
    s = get(key)
    if s is not None and s.get("custom"):
        from . import common as C
        me = C.me()
        if me is None or owner_of(key) != me:
            s = None
    if s is None:
        return {"ok": False, "error": "That story isn't in the library."}
    return {"ok": True, "story": full(s)}
