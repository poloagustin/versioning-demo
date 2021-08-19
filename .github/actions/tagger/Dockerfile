FROM node:15

RUN mkdir -p /opt/change-action

WORKDIR /opt/change-action

COPY yarn.lock /opt/change-action
COPY package.json /opt/change-action
COPY tsconfig.json /opt/change-action
COPY run.sh /opt/change-action
COPY src /opt/change-action/src

RUN yarn install && yarn cache clean && yarn build && cd $HOME

CMD ["sh", "/opt/change-action/run.sh"]
